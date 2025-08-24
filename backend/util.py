from datetime import datetime

# ========== Function ==========
def print_timestamp(step_name):
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {step_name}")


# def process_upload_document():
#