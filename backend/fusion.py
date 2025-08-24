from collections import defaultdict

def rrf_fusion(results_list, k=60):
    score_dict = defaultdict(float)
    doc_map = {}

    for results in results_list:
        for rank, doc in enumerate(results):
            key = doc.page_content.strip()
            score = 1 / (k + rank)
            score_dict[key] += score
            doc_map[key] = doc  # lưu giữ full document

    # Sắp xếp theo tổng điểm RRF
    sorted_docs = sorted(score_dict.items(), key=lambda x: x[1], reverse=True)
    return [doc_map[content] for content, _ in sorted_docs]
