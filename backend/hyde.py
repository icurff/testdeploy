

def get_hypo_doc(query,llm):
    prompt = f"""
Bạn là một trợ lý tạo tài liệu giả định (HyDE).
Nhiệm vụ: Tạo một đoạn văn bản ngắn 3–5 câu MÔ PHỎNG nội dung tài liệu thực tế có thể chứa thông tin để trả lời câu hỏi.
Yêu cầu nghiêm ngặt:
- Không trả lời câu hỏi trực tiếp, chỉ viết nội dung tài liệu giả định.
- Tránh ngôn ngữ phỏng đoán mơ hồ (ví dụ: "có thể", "có lẽ").
- Ưu tiên dữ kiện, số liệu, định nghĩa, liệt kê gọn gàng.
- Không đề cập rằng bạn là mô hình hay đang mô phỏng.

Câu hỏi: "{query}"
"""
    response = llm.invoke(prompt)
    return response.content