from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnableLambda

# Prompt chỉ yêu cầu trả về label
classification_prompt = PromptTemplate.from_template("""
You are a routing classifier. Classify the user's question into exactly one of:
- retrieve: needs knowledge grounded in our indexed documents (RAG).
- search: needs up-to-date or external web information.
- chitchat: small talk or conversational without knowledge needs.

Return only one lowercase word: retrieve, search, or chitchat.
Question: {question}
""")


# === Router chain ===
def build_router_node(llm):
    classification_chain = classification_prompt | llm | StrOutputParser()

    def classify(state):
        question = state["question"]
        label = classification_chain.invoke({"question": question}).strip().lower()
        valid_labels = {"retrieve", "search", "chitchat"}
        print(label)
        if label not in valid_labels:
            label = "chitchat"

        return {
            "classification": label,
            "question": question
        }

    return RunnableLambda(classify)
