import boto3
import os
import time


region = os.getenv("AWS_REGION_NAME")

class S3Upload(object):
    def __init__(self):
        self.s3 = boto3.client('s3', region_name=region)

    def is_bucket_exist(self, bucket_name):
        try:
            response = self.s3 .list_buckets()
            buckets = [bucket['Name'] for bucket in response['Buckets']]
            return bucket_name in buckets
        except Exception as e:
            return False

    def create_bucket(self, bucket_name):
        try:
            location = {'LocationConstraint': region}
            self.s3 .create_bucket(Bucket=bucket_name,
                             CreateBucketConfiguration=location)
        except Exception as e:
            print("Create bucket error:", e)
            return False
        return True

    def get_presigned_url(self, bucket_name, s3_key, expiration=3600):
        return self.s3.generate_presigned_url(
            'get_object',
            Params={'Bucket': bucket_name, 'Key': s3_key},
            ExpiresIn=expiration
        )

    def upload_file_to_s3(self, file, object_name, bucket_name, username):
        unique_prefix = str(int(time.time()))
        file_path = f"{username}/{unique_prefix}_{object_name}"
        s3_file_url = f"http://{bucket_name}.s3.amazonaws.com/{file_path}"
        try:
            response = self.s3 .upload_fileobj(
                file,
                bucket_name,
                file_path
            )
            return self.get_presigned_url(bucket_name,file_path)
        except Exception as e:
            print(f"Upload failed: {e}")
            return None

    def list_user_files(self, bucket_name, username):
        """List all files for a specific user in S3"""
        try:
            response = self.s3.list_objects_v2(
                Bucket=bucket_name,
                Prefix=f"{username}/"
            )

            
            files = []
            if 'Contents' in response:
                for obj in response['Contents']:
                    key = obj['Key']
                    
                    # Skip if it's just a folder
                    if key.endswith('/'):
                        continue
                    
                    # Extract filename from key (remove username prefix and timestamp)
                    filename_parts = key.replace(f"{username}/", "").split('_', 1)
                    if len(filename_parts) > 1:
                        original_filename = filename_parts[1]
                    else:
                        original_filename = filename_parts[0]

                    
                    file_info = {
                        'key': key,
                        'filename': original_filename,
                        'url': self.get_presigned_url(bucket_name, key),
                        'size': obj['Size'],
                        'last_modified': obj['LastModified'].isoformat(),
                        'type': self._get_file_type(original_filename)
                    }
                    files.append(file_info)
            return files
        except Exception as e:

            import traceback
            traceback.print_exc()
            return []

    def delete_file_from_s3(self, bucket_name, file_key):
        """Delete a specific file from S3"""
        try:
            self.s3.delete_object(Bucket=bucket_name, Key=file_key)
            return True
        except Exception as e:
            print(f"Delete failed: {e}")
            return False

    def _get_file_type(self, filename):
        """Get file type from filename extension"""
        if '.' not in filename:
            return 'unknown'
        
        extension = filename.lower().split('.')[-1]
        
        type_mapping = {
            'pdf': 'pdf',
            'doc': 'document',
            'docx': 'document',
            'txt': 'text',
            'png': 'image',
            'jpg': 'image',
            'jpeg': 'image',
            'gif': 'image'
        }
        
        return type_mapping.get(extension, 'unknown')




