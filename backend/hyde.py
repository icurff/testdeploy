

def get_hypo_doc(query,llm):
    prompt = f"""
    Bạn là một trợ lý AI. Dựa trên câu hỏi sau: "{query}", hãy mô phỏng một đoạn văn bản ngắn (3-5 câu) giống như nội dung trong một tài liệu thực tế, chứa thông tin có thể trả lời câu hỏi đó.
    Không trả lời trực tiếp, chỉ tạo ra đoạn văn mô phỏng tài liệu.
    """
    response = llm.invoke(prompt)
    return response.content