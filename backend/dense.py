import os
from langchain_qdrant import QdrantVectorStore

def find_similarity(hypo_emb,k,embed_model,username):
    # doc_store = QdrantVectorStore.from_documents(
    #     documents=splits,
    #     embedding=embed_model,
    #     url="https://6fbd9042-2153-49e0-8c5b-d9da2f8d9e60.us-west-2-0.aws.cloud.qdrant.io:6333",
    #     api_key=api_key,
    #     collection_name="demo2")
    doc_store = QdrantVectorStore.from_existing_collection(
        embedding=embed_model,
        url="https://6fbd9042-2153-49e0-8c5b-d9da2f8d9e60.us-west-2-0.aws.cloud.qdrant.io:6333",
        api_key=os.environ["Qdrant_api_key"],
        collection_name=username)
    results = doc_store.similarity_search_by_vector(hypo_emb, k)
    return results



