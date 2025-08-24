# ==== Imports ====
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_core.runnables import RunnableMap, RunnablePassthrough, RunnableLambda, RunnableConfig
from langchain_core.output_parsers import StrOutputParser

from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain_community.chat_message_histories import DynamoDBChatMessageHistory
from langchain_tavily import TavilySearch

from elastic_search import bm25_search
from util import print_timestamp
# ==== Custom Retrieval Functions ====
from hyde import get_hypo_doc  # HyDE: sinh câu hỏi giả định
from dense import find_similarity  # Tìm kiếm dense (vector)

from fusion import rrf_fusion  # Fusion hai kết quả




def retrieve(query: str, llm, embed_model, username: str) -> list[Document]:
    print_timestamp("🧠 [HyDE] Generating hypothetical document...")
    hypo_doc = get_hypo_doc(query, llm)
    print("📄 Hypothetical Document:\n", hypo_doc)

    print_timestamp("📍 [Embed] Embedding hypo_doc and finding dense similarity...")
    hypo_emb = embed_model.embed_query(hypo_doc)
    dense_results = find_similarity(hypo_emb, k=10, embed_model=embed_model, username=username)
    print(f"🔎 Dense results (top 10): {[doc.metadata.get('source', '') for doc in dense_results]}")

    print_timestamp("🔍 Lexical search...")
    sparse_results = bm25_search(username,query)
    print(f"🧾 Sparse results (top 5): {[doc.metadata.get('source', '') for doc in sparse_results]}")

    print_timestamp("🔗 [Fusion] RRF Fusion of dense + sparse...")
    combined_results = rrf_fusion([dense_results,sparse_results])
    print("✅ Top 5 after fusion:")
    for i, doc in enumerate(combined_results[:5]):
        print(f"  {i + 1}.- {doc.page_content}...")

    return combined_results[:5]


# ==== Chains ====
def create_rag_chain(llm, embed_model, reranker, username):
    def _retrieve(inputs: dict) -> dict:
        query = inputs["question"]
        docs = retrieve(query, llm, embed_model, username)
        print("⚖️ [Reranker] Re-ranking fused results...")
        reranked_docs = reranker.compress_documents(docs,query)

        return {
            "context": "\n\n".join(doc.page_content for doc in reranked_docs),
            "question": query,
            "history": inputs.get("history", [])
        }

    chain = RunnableLambda(_retrieve) | rag_prompt | llm | StrOutputParser()
    return RunnableWithMessageHistory(
        chain,
        get_session_history=get_history_session,
        input_messages_key="question",
        history_messages_key="history"
    )


search_tool = TavilySearch(max_results=3)


def create_search_chain(llm):
    def search_with_tavily(inputs: dict):
        query = inputs["question"]
        docs = search_tool.invoke(query)
        context = "\n\n".join(
            doc["content"] for doc in docs["results"] if doc.get("content")
        )
        return {
            "context": context,
            "question": query,
            "history": inputs.get("history", [])
        }

    chain = RunnableLambda(search_with_tavily) | search_prompt | llm | StrOutputParser()
    return RunnableWithMessageHistory(
        chain,
        get_session_history=get_history_session,
        input_messages_key="question",
        history_messages_key="history"
    )


def create_chat_chain(llm):
    chain = chat_prompt | llm | StrOutputParser()
    return RunnableWithMessageHistory(
        chain,
        get_session_history=get_history_session,
        input_messages_key="question",
        history_messages_key="history"
    )


# ==== Prompt Template ====
rag_prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful assistant. Use the following context to answer the question."),
    ("system", "{context}"),
    MessagesPlaceholder(variable_name="history", optional=True),
    ("human", "{question}"),
])

search_prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a search assistant. Use the search results to answer the question."),
    ("system", "{context}"),
    MessagesPlaceholder(variable_name="history", optional=True),
    ("human", "{question}"),
])

chat_prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a friendly chatbot."),
    MessagesPlaceholder(variable_name="history", optional=True),
    ("human", "{question}"),
])


def get_history_session(session_id: str):
    # Ghép session_id từ user_id#conv_id hoặc tách ra
    user_id, conv_id = session_id.split("#", 1)

    return DynamoDBChatMessageHistory(
        table_name="Conversations",
        session_id=session_id,
        primary_key_name="user_id",
        key={
            "user_id": user_id,
            "conv_id": conv_id,
        },
        history_messages_key="history"
    )
