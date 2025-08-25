import json
from typing import List, Optional
import traceback
import boto3
import base64
from boto3.dynamodb.conditions import Key
from authlib.integrations.starlette_client import OAuth
from botocore.exceptions import ClientError
from elasticsearch import Elasticsearch
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from langchain_core.runnables import RunnableBranch
from fastapi import FastAPI, Request
from langchain_text_splitters import RecursiveCharacterTextSplitter
from starlette.middleware.sessions import SessionMiddleware
from starlette.responses import RedirectResponse, HTMLResponse, JSONResponse
import uuid
from datetime import datetime, timezone

from main import build_router_node
from uploads3 import S3Upload
import io
from langchain_community.document_loaders import PyPDFLoader
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_experimental.text_splitter import SemanticChunker
from langchain_qdrant import QdrantVectorStore
import os
from fastapi import BackgroundTasks
from pydantic import BaseModel

from elastic_search import index_splits_bm25
from util import print_timestamp
from rag_pipeline import create_rag_chain, \
    create_search_chain, create_chat_chain
from contextlib import asynccontextmanager
from langchain.retrievers.document_compressors import CrossEncoderReranker
from langchain_community.cross_encoders import HuggingFaceCrossEncoder


# load model
@asynccontextmanager
async def lifespan(app: FastAPI):
    print_timestamp("🚀 Loading embedding model...")

    app.state.embed_model = HuggingFaceEmbeddings(
        model_name="intfloat/multilingual-e5-large",
        model_kwargs={"device": "cpu"},
        encode_kwargs={"normalize_embeddings": True}
    )

    # app.state.embed_model = HuggingFaceEmbeddings(
    #     model_name="./models/bge-m3",
    #      model_kwargs={"device": "cpu","trust_remote_code": True},
    #     # encode_kwargs={"normalize_embeddings": True}
    # )
    print_timestamp("🚀 Finish loading embedding model...")
    print_timestamp("🚀 Loading reranker model...")
    cross_encoder = HuggingFaceCrossEncoder(
        model_name="BAAI/bge-reranker-v2-m3",
    )
    app.state.reranker = CrossEncoderReranker(model=cross_encoder,top_n=5)
    app.state.llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        temperature=0.5,
        max_output_tokens=2048,
    )
    print_timestamp("🚀 Finish loading reranker model...")


    yield  # <== Sau yield là logic khi shutdown (nếu cần)
    print_timestamp("🧹 App shutdown. Clean up if needed.")


app = FastAPI(lifespan=lifespan)
from fastapi.middleware.cors import CORSMiddleware

origins = [
    "http://localhost:5173",
    "http://165.22.103.53",
    "https://165.22.103.53",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(SessionMiddleware, secret_key=os.urandom(24))


def auth_middleware(request: Request):
    token = request.cookies.get("access_token")
    if not token:
        authorization = request.headers.get("Authorization")
        if authorization and authorization.startswith("Bearer "):
            token = authorization.split(" ")[1]

    if not token:
        raise HTTPException(
            status_code=401,
            detail="Access token not found"
        )

    try:
        user_data = cognito_client.get_user(AccessToken=token)

        email = ""
        user_id = ""
        username = user_data["Username"]

        for attr in user_data["UserAttributes"]:
            if attr["Name"] == "email":
                email = attr["Value"]
            elif attr["Name"] == "sub":
                user_id = attr["Value"]

        return {
            "user_id": user_id,
            "email": email,
            "username": username
        }
    except ClientError:
        raise HTTPException(status_code=401, detail="Invalid token")


aws = S3Upload()

# Document status tracking
def get_document_status_table():
    return dynamodb.Table('DocumentStatus')

def update_document_status(username: str, status: str, file_keys: List[str] = None):
    """Update document processing status for a user"""
    table = get_document_status_table()
    timestamp = datetime.now(timezone.utc).isoformat()
    
    try:
        if status == "processing":
            # Start processing - store file keys being processed
            table.put_item(Item={
                "username": username,
                "status": status,
                "file_keys": file_keys or [],
                "started_at": timestamp,
                "updated_at": timestamp
            })
        else:
            # Update existing status
            table.update_item(
                Key={"username": username},
                UpdateExpression="SET #status = :status, updated_at = :updated_at",
                ExpressionAttributeNames={"#status": "status"},
                ExpressionAttributeValues={
                    ":status": status,
                    ":updated_at": timestamp
                }
            )
    except Exception as e:
        print(f"Error updating document status: {e}")

def get_document_status(username: str):
    """Get current document processing status for a user"""
    table = get_document_status_table()
    try:
        response = table.get_item(Key={"username": username})
        if 'Item' in response:
            return response['Item']
        return {"status": "no_documents", "updated_at": datetime.now(timezone.utc).isoformat()}
    except Exception as e:
        print(f"Error getting document status: {e}")
        return {"status": "no_documents", "updated_at": datetime.now(timezone.utc).isoformat()}

# Upload documents and process
@app.post("/api/upload/")
async def upload_files( files: List[UploadFile] = File(...),
                       user_data: dict = Depends(auth_middleware)):
    results = []
    bucket_name = "arag"
    username = user_data["username"]
    all_file_urls = []
    file_keys = []

    if not aws.is_bucket_exist(bucket_name):
        created = aws.create_bucket(bucket_name)
        if not created:
            return {"error": "Bucket creation failed"}

    for file in files:
        contents = await file.read()
        file_stream = io.BytesIO(contents)
        file_url = aws.upload_file_to_s3(file_stream, file.filename, bucket_name, username)
        if file_url:
            # Extract file key from URL
            file_key = file_url.split('/')[-1]
            file_keys.append(file_key)
            all_file_urls.append(file_url)
            results.append({"filename": file.filename, "url": file_url, "size": file.size, "type": file.content_type})
        else:
            results.append({"filename": file.filename, "error": "Upload failed"})

    # Update status to indicate documents are waiting but not processed
    update_document_status(username, "waiting", file_keys)

    return {"files": results}

def process_files(embed_model, file_urls: List[str], username: str):
    all_splits = []

    print_timestamp("Start processing files")

    # Update status to processing
    update_document_status(username, "processing")

    try:
        # --- Choose text splitter ---
        print_timestamp("Initializing text splitter")
        # splitter = SemanticChunker(
        #     embeddings=embed_model,
        #     breakpoint_threshold_type="percentile",
        #     breakpoint_threshold_amount=95
        # )

        splitter = RecursiveCharacterTextSplitter(chunk_size=10000, chunk_overlap=500)

        # --- Load and split documents ---
        for file_url in file_urls:
            print_timestamp(f"Loading document: {file_url}")
            loader = PyPDFLoader(file_url)
            docs = loader.load()

            print_timestamp(f"Splitting document: {file_url}")
            splits = splitter.split_documents(docs)
            # full_text = "\n\n".join([doc.page_content for doc in docs])
            # big_doc = Document(page_content=full_text)

            # print_timestamp(f"Splitting document: {file_url}")
            # splits = splitter.split_documents([big_doc])

            file_name = os.path.basename(file_url)
            for split in splits:
                split.metadata["source"] = file_name
                split.metadata["username"] = username
                all_splits.append(split)

         # --- Index to Elasticsearch ---
        print_timestamp("Index to Elasticsearch" )
        index_splits_bm25(username, all_splits),

        # --- Index to Qdrant ---
        print_timestamp("Indexing to Qdrant")

        vectordb = QdrantVectorStore.from_documents(
            documents=all_splits,
            embedding=embed_model,
            url="https://6fbd9042-2153-49e0-8c5b-d9da2f8d9e60.us-west-2-0.aws.cloud.qdrant.io:6333",
            api_key=os.environ["Qdrant_api_key"],
            collection_name=username,
            force_recreate=True,
            timeout=30

        )

        print_timestamp("Finished processing files")
        
        # Update status to processed
        update_document_status(username, "processed")
        
    except Exception as e:
        print_timestamp(f"Error processing files: {e}")
        # Update status to error
        update_document_status(username, "error")

# Get documents
@app.get("/api/documents/")
async def list_documents(user_data: dict = Depends(auth_middleware)):
    """List all documents for the authenticated user"""
    bucket_name = "arag"
    username = user_data["username"]

    try:
        files = aws.list_user_files(bucket_name, username)
        return {"documents": files}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to list documents")

# Get document processing status
@app.get("/api/documents/status")
async def get_documents_status(user_data: dict = Depends(auth_middleware)):
    """Get the current processing status of documents for the user"""
    username = user_data["username"]
    try:
        status = get_document_status(username)
        return status
    except Exception as e:
        print(f"Error getting document status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get document status")

# Process documents manually
@app.post("/api/documents/process")
async def process_documents(background_tasks: BackgroundTasks, user_data: dict = Depends(auth_middleware)):
    """Manually trigger document processing"""
    username = user_data["username"]
    bucket_name = "arag"
    
    try:
        # Get current status
        current_status = get_document_status(username)
        
        # Check if documents are already being processed
        if current_status.get("status") == "processing":
            raise HTTPException(status_code=400, detail="Documents are already being processed")
        
        # Get user's documents
        files = aws.list_user_files(bucket_name, username)
        if not files:
            raise HTTPException(status_code=400, detail="No documents to process")
        
        # Get file URLs for processing
        file_urls = [file["url"] for file in files]
        
        # Start processing in background
        embed_model = app.state.embed_model
        background_tasks.add_task(process_files, embed_model, file_urls, username)
        
        return {"message": "Document processing started"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error starting document processing: {e}")
        raise HTTPException(status_code=500, detail="Failed to start document processing")

# Delete document
@app.delete("/api/documents/{file_key:path}")
async def delete_document(file_key: str, user_data: dict = Depends(auth_middleware)):
    """Delete a specific document from S3"""
    bucket_name = "arag"
    username = user_data["username"]

    # Security check: ensure user can only delete their own files
    if not file_key.startswith(f"{username}/"):
        raise HTTPException(status_code=403, detail="You can only delete your own files")

    # Check if documents are being processed
    current_status = get_document_status(username)
    if current_status.get("status") == "processing":
        raise HTTPException(status_code=400, detail="Cannot delete documents while processing")

    try:
        success = aws.delete_file_from_s3(bucket_name, file_key)
        if success:
            # Update status to indicate documents need processing
            update_document_status(username, "waiting")
            return {"message": "Document deleted successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to delete document")
    except Exception as e:
        print(f"Error deleting document: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete document")




# Request body models
class ChatRequest(BaseModel):
    session_id: str
    question: str


class ConversationRequest(BaseModel):
    name: Optional[str] = None


class ConversationUpdateRequest(BaseModel):
    name: str


class ConversationResponse(BaseModel):
    conv_id: str
    name: str
    created_at: str
    updated_at: str


class ChatRequestNew(BaseModel):
    conv_id: str
    question: str

# send a message
@app.post("/api/chat/send")
async def chat_send(req: ChatRequestNew, user_data: dict = Depends(auth_middleware)):

    try:
        user_id = user_data["user_id"]
        username = user_data["username"]

        # Kiểm tra conversation có tồn tại và thuộc về user không
        response = conversations_table.get_item(
            Key={
                "user_id": user_id,
                "conv_id": req.conv_id
            }
        )

        if 'Item' not in response:
            raise HTTPException(status_code=404, detail="Conversation not found")

        embed_model = app.state.embed_model
        llm = app.state.llm
        reranker = app.state.reranker
        rag_chain = create_rag_chain(llm, embed_model,reranker, username)
        search_chain = create_search_chain(llm)
        chat_chain = create_chat_chain(llm)
        router_node = build_router_node(llm)

        full_chain = router_node | RunnableBranch(
            (lambda state: state["classification"] == "retrieve", rag_chain),
            (lambda state: state["classification"] == "search", search_chain),
            (lambda state: state["classification"] == "chitchat", chat_chain),
            chat_chain  # fallback
        )
        session_id = f"{user_id}#{req.conv_id}"

        # Gọi chain với session_id
        config = {"configurable": {"session_id": session_id}}
        bot_response = full_chain.invoke({"question": req.question}, config=config)

        # Cập nhật last_message và updated_at trong conversation
        timestamp = datetime.now(timezone.utc).isoformat()
        conversations_table.update_item(
            Key={
                "user_id": user_id,
                "conv_id": req.conv_id
            },
            UpdateExpression="SET last_message = :last_message, updated_at = :updated_at",
            ExpressionAttributeValues={
                ":last_message": req.question[:100] + ("..." if len(req.question) > 100 else ""),
                ":updated_at": timestamp
            }
        )

        return {"response": bot_response}

    except HTTPException:
        raise
    except Exception as e:
        print("Error in chat_send:", str(e))
        traceback.print_exc()  # in full stack trace ra stdout/log
        raise HTTPException(status_code=500, detail="Failed to send message")


oauth = OAuth()
oauth.register(
    name='oidc',
    authority='https://cognito-idp.ap-southeast-1.amazonaws.com/ap-southeast-1_XpQcyxaue',
    client_id=os.getenv("AWS_CLIENT_ID"),
    client_secret='1fo13vkf7d2kb2bp786l9ha1mq1cpe5l3883c0u3umhcnqcs77ci',
    server_metadata_url='https://cognito-idp.ap-southeast-1.amazonaws.com/ap-southeast-1_XpQcyxaue/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email phone'},
)


@app.get("/api/me")
async def get_current_user(user_data: dict = Depends(auth_middleware)):
    return user_data


# Conversation Management APIs
@app.get("/api/conversations")
async def get_conversations(user_data: dict = Depends(auth_middleware)):
    """Lấy tất cả conversations của user"""
    try:
        user_id = user_data["user_id"]

        response = conversations_table.query(
            KeyConditionExpression=Key('user_id').eq(user_id),
            ScanIndexForward=False  # Sắp xếp theo timestamp mới nhất
        )

        conversations = []
        for item in response['Items']:
            conversations.append({
                "conv_id": item['conv_id'],
                "name": item['name'],
                "created_at": item.get('created_at', ''),
                "updated_at": item.get('updated_at', ''),
            })

        return {"conversations": conversations}

    except Exception as e:
        print(f"Error getting conversations: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get conversations")


@app.post("/api/conversations")
async def create_conversation(
        req: ConversationRequest,
        user_data: dict = Depends(auth_middleware)
):
    """Tạo conversation mới"""
    try:
        user_id = user_data["user_id"]
        conv_id = str(uuid.uuid4())[:8]  # Tạo conversation ID ngắn
        timestamp = datetime.now(timezone.utc).isoformat()

        final_name = (req.name or "").strip() or "New Chat"

        conversation_item = {
            "user_id": user_id,
            "conv_id": conv_id,
            "name": final_name,
            "created_at": timestamp,
            "updated_at": timestamp,
            "history": ""
        }

        conversations_table.put_item(Item=conversation_item)

        return {
            "conv_id": conv_id,
            "name": final_name,
            "created_at": timestamp,
            "updated_at": timestamp
        }

    except Exception as e:
        print(f"Error creating conversation: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create conversation")


@app.put("/api/conversations/{conv_id}")
async def update_conversation(
        conv_id: str,
        req: ConversationUpdateRequest,
        user_data: dict = Depends(auth_middleware)
):
    """Cập nhật tên conversation"""
    try:
        user_id = user_data["user_id"]
        timestamp = datetime.now(timezone.utc).isoformat()

        # Kiểm tra conversation có tồn tại và thuộc về user không
        response = conversations_table.get_item(
            Key={
                "user_id": user_id,
                "conv_id": conv_id
            }
        )

        if 'Item' not in response:
            raise HTTPException(status_code=404, detail="Conversation not found")

        # Cập nhật conversation
        conversations_table.update_item(
            Key={
                "user_id": user_id,
                "conv_id": conv_id
            },
            UpdateExpression="SET #name = :name, updated_at = :updated_at",
            ExpressionAttributeNames={
                "#name": "name"
            },
            ExpressionAttributeValues={
                ":name": req.name,
                ":updated_at": timestamp
            }
        )

        return {"message": "Conversation updated successfully"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating conversation: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update conversation")


@app.delete("/api/conversations/{conv_id}")
async def delete_conversation(
        conv_id: str,
        user_data: dict = Depends(auth_middleware)
):
    """Xóa conversation"""
    try:
        user_id = user_data["user_id"]

        # Kiểm tra conversation có tồn tại và thuộc về user không
        response = conversations_table.get_item(
            Key={
                "user_id": user_id,
                "conv_id": conv_id
            }
        )

        if 'Item' not in response:
            raise HTTPException(status_code=404, detail="Conversation not found")

        # Xóa conversation
        conversations_table.delete_item(
            Key={
                "user_id": user_id,
                "conv_id": conv_id
            }
        )

        return {"message": "Conversation deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting conversation: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete conversation")


@app.get("/api/conversations/{conv_id}/history")
async def get_conversation_history(conv_id: str, user_data: dict = Depends(auth_middleware)):
    """Return normalized message history for a specific conversation"""
    try:
        user_id = user_data["user_id"]

        response = conversations_table.get_item(
            Key={
                "user_id": user_id,
                "conv_id": conv_id
            }
        )

        if 'Item' not in response:
            raise HTTPException(status_code=404, detail="Conversation not found")

        item = response['Item']
        raw_history = item.get("history", []) or []

        messages = []
        # Normalize LangChain DynamoDBChatMessageHistory format to frontend shape
        for index, entry in enumerate(raw_history):
            try:
                # Support multiple possible shapes
                if isinstance(entry, dict):
                    entry_type = entry.get("type") or entry.get("role") or ""
                    data = entry.get("data") or {}
                    content = data.get("content") or entry.get("content") or ""
                else:
                    # Fallback if stored as plain string
                    entry_type = "ai"
                    content = str(entry)

                sender = "user" if entry_type in ("human", "user") else "bot"
                messages.append({
                    "id": f"{index}",
                    "content": content,
                    "sender": sender,
                    # Timestamps are not stored per-message in this history; use conversation timestamps if needed
                    "timestamp": item.get("updated_at") or item.get("created_at") or datetime.now(timezone.utc).isoformat(),
                })
            except Exception:
                # Skip malformed entries but continue
                continue

        return {"conv_id": conv_id, "messages": messages}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting conversation history: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get conversation history")

region = os.getenv("AWS_REGION_NAME")
cognito_client = boto3.client("cognito-idp", region_name=region)
dynamodb = boto3.resource('dynamodb', region_name=region)
conversations_table = dynamodb.Table('Conversations')

USER_POOL_ID = "ap-southeast-1_XpQcyxaue"


class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ConfirmForgotPasswordRequest(BaseModel):
    email: str
    code: str
    new_password: str


@app.post("/api/register")
async def register_user(request: RegisterRequest):
    try:
        username = request.username
        email = request.email
        password = request.password

        cognito_client.admin_create_user(
            UserPoolId=USER_POOL_ID,
            Username=username,
            UserAttributes=[
                {"Name": "email", "Value": email},
                {"Name": "email_verified", "Value": "true"},
            ],
            MessageAction="SUPPRESS"  # Không gửi email xác nhận
        )

        cognito_client.admin_set_user_password(
            UserPoolId=USER_POOL_ID,
            Username=username,
            Password=password,
            Permanent=True
        )

        response = cognito_client.initiate_auth(
            ClientId=os.getenv("AWS_CLIENT_ID"),
            AuthFlow="USER_PASSWORD_AUTH",
            AuthParameters={
                "USERNAME": username,
                "PASSWORD": password
            }
        )
        id_token = response['AuthenticationResult']['IdToken']
        access_token = response['AuthenticationResult']['AccessToken']
        refresh_token = response['AuthenticationResult']['RefreshToken']



        return {
            "status": "success",
            "id_token": id_token,
            "access_token": access_token,
            "refresh_token": refresh_token
        }

    except cognito_client.exceptions.UsernameExistsException:
        raise HTTPException(status_code=400, detail="User already exists")


    except Exception as e:
        print("Unhandled error during registration:")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/login")
async def login_user(request: LoginRequest):
    try:
        email = request.email
        password = request.password

        # Xác thực user với AWS Cognito
        response = cognito_client.initiate_auth(
            ClientId=os.getenv("AWS_CLIENT_ID"),
            AuthFlow="USER_PASSWORD_AUTH",
            AuthParameters={
                "USERNAME": email,
                "PASSWORD": password
            }
        )
        access_token = response['AuthenticationResult']['AccessToken']
        refresh_token = response['AuthenticationResult']['RefreshToken']

        user_data = cognito_client.get_user(
            AccessToken=access_token
        )
        email = ""
        user_id = ""
        username = user_data["Username"]

        for attr in user_data["UserAttributes"]:
            if attr["Name"] == "email":
                email = attr["Value"]
            elif attr["Name"] == "sub":
                user_id = attr["Value"]

        return {
            "status": "success",
            "user": {
                "user_id": user_id,
                "email": email,
                "username": username
            },
            "access_token": access_token,
            "refresh_token": refresh_token
        }

    except cognito_client.exceptions.NotAuthorizedException:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    except cognito_client.exceptions.UserNotConfirmedException:
        raise HTTPException(status_code=400, detail="User not confirmed. Please check your email for confirmation.")

    except cognito_client.exceptions.UserNotFoundException:
        raise HTTPException(status_code=404, detail="User not found")

    except cognito_client.exceptions.TooManyRequestsException:
        raise HTTPException(status_code=429, detail="Too many requests. Please try again later.")

    except Exception as e:
        print(f"Unhandled error during login: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/api/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    """Initiate Cognito password reset flow by sending a verification code to the user's email/alias."""
    try:
        cognito_client.forgot_password(
            ClientId=os.getenv("AWS_CLIENT_ID"),
            Username=request.email,
        )
        # For privacy, do not reveal whether the user exists
        return {"message": "If an account exists for this email, a verification code has been sent."}
    except cognito_client.exceptions.UserNotFoundException:
        # Still return success to avoid user enumeration
        return {"message": "If an account exists for this email, a verification code has been sent."}
    except cognito_client.exceptions.LimitExceededException:
        raise HTTPException(status_code=429, detail="Too many attempts. Please try again later.")
    except Exception as e:
        print(f"Unhandled error during forgot-password: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/api/confirm-forgot-password")
async def confirm_forgot_password(request: ConfirmForgotPasswordRequest):
    """Confirm password reset with the code sent to user's email/alias, and set a new password."""
    try:
        cognito_client.confirm_forgot_password(
            ClientId=os.getenv("AWS_CLIENT_ID"),
            Username=request.email,
            ConfirmationCode=request.code,
            Password=request.new_password,
        )
        return {"message": "Password has been reset successfully."}
    except cognito_client.exceptions.CodeMismatchException:
        raise HTTPException(status_code=400, detail="Invalid verification code.")
    except cognito_client.exceptions.ExpiredCodeException:
        raise HTTPException(status_code=400, detail="Verification code has expired.")
    except cognito_client.exceptions.UserNotFoundException:
        # Do not reveal existence; return generic error
        raise HTTPException(status_code=400, detail="Invalid verification code or user.")
    except Exception as e:
        print(f"Unhandled error during confirm-forgot-password: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
