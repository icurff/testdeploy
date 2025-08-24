from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnableLambda

# Prompt chỉ yêu cầu trả về label
classification_prompt = PromptTemplate.from_template("""
You are a classifier that routes user questions into one of the following categories:
- retrieve: the question requires knowledge from documents.
- search: the question needs real-time or external information.
- chitchat: the question is casual or small talk.

Return only one word: retrieve, search, or chitchat.
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
