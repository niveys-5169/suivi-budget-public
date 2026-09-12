import json
import logging
import os
import requests
from google.oauth2 import service_account
from google.auth.transport.requests import Request

log = logging.getLogger(__name__)

def get_id_token(target_audience: str) -> str:
    """
    Fetch an ID token for the given target_audience using FIREBASE_CREDENTIALS.
    """
    cred_json = os.environ.get("FIREBASE_CREDENTIALS")
    if not cred_json:
        raise RuntimeError("FIREBASE_CREDENTIALS environment variable is missing.")

    try:
        cred_dict = json.loads(cred_json)
        # Use IDTokenCredentials to specifically get an ID Token for Cloud Functions
        creds = service_account.IDTokenCredentials.from_service_account_info(
            cred_dict, target_audience=target_audience
        )
        
        # Refresh the token to get the actual ID token
        creds.refresh(Request())
        return creds.token
    except Exception as e:
        log.error(f"Failed to fetch ID token: {e}")
        raise

def call_on_call_function(function_name: str, data: dict, region: str = "europe-west1") -> dict:
    """
    Calls a Firebase on_call Cloud Function.
    
    Requirement:
    1. Target the endpoint: https://<region>-<project-id>.cloudfunctions.net/<function-name>
    2. Header: Content-Type: application/json
    3. Header: Authorization: Bearer <ID_TOKEN>
    4. Body: {"data": { ... your payload ... }}
    """
    cred_json = os.environ.get("FIREBASE_CREDENTIALS")
    if not cred_json:
        raise RuntimeError("FIREBASE_CREDENTIALS environment variable is missing.")
    
    try:
        cred_dict = json.loads(cred_json)
        project_id = cred_dict.get("project_id")
        if not project_id:
            raise ValueError("project_id missing in FIREBASE_CREDENTIALS")
        
        url = f"https://{region}-{project_id}.cloudfunctions.net/{function_name}"
        
        log.info(f"Calling Cloud Function: {function_name} at {url}")
        
        token = get_id_token(url)
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}"
        }
        
        # Send data directly for on_request functions
        response = requests.post(url, json=data, headers=headers, timeout=30)
        
        if response.status_code != 200:
            log.error(f"Cloud Function call failed ({response.status_code}): {response.text}")
            response.raise_for_status()
            
        result = response.json()
        
        # on_call functions return the result in a "result" field (or "error")
        if "error" in result:
            log.error(f"Cloud Function returned an error: {result['error']}")
            raise RuntimeError(f"Cloud Function error: {result.get('error')}")
            
        return result.get("result")
    except Exception as e:
        log.error(f"Error calling Cloud Function {function_name}: {e}")
        raise
