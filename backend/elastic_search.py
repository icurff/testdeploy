import os
from typing import Dict

from elasticsearch import Elasticsearch, helpers
from langchain_elasticsearch import ElasticsearchRetriever

es_client = Elasticsearch("https://my-elasticsearch-project-b2562c.es.ap-southeast-1.aws.elastic.cloud:443",
                          api_key=os.environ.get("ELASTIC_SEARCH_API_KEY"))

text_field = "content"



def create_index_bm25(username):
    # Nếu index đã tồn tại thì bỏ qua
    if es_client.indices.exists(index=username):
        es_client.indices.delete(index=username)

    es_client.indices.create(
        index=username,
        body={
            "mappings": {
                "properties": {
                    "content": {"type": "text"}
                }
            }
        }
    )


def index_splits_bm25(username, splits, refresh=True):
    create_index_bm25(username)

    requests = []
    for i, doc in enumerate(splits):
        body = {
            text_field: doc.page_content,
        }

        requests.append({
            "_op_type": "index",
            "_index": username,
            "_id": f"{doc.metadata.get('source', '')}-{i}",
            **body
        })

    helpers.bulk(es_client, requests)

    if refresh:
        es_client.indices.refresh(index=username)

    return len(requests)


def bm25_query(search_query: str) -> Dict:
    return {
        "query": {
            "match": {
                text_field: search_query,
            },
        },
    }


def bm25_search(username, query):
    bm25_retriever = ElasticsearchRetriever.from_es_params(
        index_name=username,
        body_func=bm25_query,
        content_field=text_field,
        url= "https://my-elasticsearch-project-b2562c.es.ap-southeast-1.aws.elastic.cloud:443",
        api_key=os.environ.get("ELASTIC_SEARCH_API_KEY"),
    )

    return bm25_retriever.invoke(query)

