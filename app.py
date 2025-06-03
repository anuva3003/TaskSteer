from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
from flask_cors import CORS
import os
import datetime
import json
import re
import google.generativeai as genai
import firebase_admin
from firebase_admin import credentials, firestore
import traceback # For detailed error logging
from flask_cors import CORS
print("📁 Current working directory:", os.getcwd())
print("📂 Files in this directory:", os.listdir())
# === CONFIGURE GEMINI ===
# IMPORTANT: Replace with your actual GOOGLE_API_KEY or load from an environment variable.
GOOGLE_API_KEY = "AIzaSyB7c9c4v-TrsEq9jKUMfuv-gi_4c1rjmX0" # <--- REPLACE THIS
if GOOGLE_API_KEY == "YOUR_GOOGLE_API_KEY":
    print("⚠️ WARNING: Please replace 'YOUR_GOOGLE_API_KEY' with your actual Google API Key for Gemini.")

genai.configure(api_key=GOOGLE_API_KEY)
try:
    model = genai.GenerativeModel("models/gemini-1.5-flash")
    print("✅ Gemini Model initialized successfully.")
except Exception as e:
    print(f"🔥❌❌❌ Gemini Model Initialization Error: {e} ❌❌❌🔥")
    model = None

# === INITIALIZE FIRESTORE ===
# IMPORTANT: Ensure 'serviceAccountKey.json' is in the same directory as your app.py
# or provide the correct path. Also, ensure the service account has Firestore permissions.
db = None # Initialize db as None
try:
    cred = credentials.Certificate("C:/Users/anuvarshini.bharath_/Downloads/TaskSteer/TaskSteer/tasksteer-backend/serviceAccountKey.json")
 # Or "path/to/your/serviceAccountKey.json"
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    print("✅ Firebase Admin SDK initialized successfully and Firestore client obtained.")
except FileNotFoundError:
    print("🔥❌❌❌ Firebase Admin SDK Initialization Error: 'serviceAccountKey.json' not found. ❌❌❌🔥")
    print("Ensure the service account key file is in the correct path.")
except Exception as e:
    print(f"🔥❌❌❌ Firebase Admin SDK Initialization Error: {e} ❌❌❌🔥")
    traceback.print_exc()


# === INITIALIZE FLASK APP ===
# === INITIALIZE FLASK APP ===
app = Flask(__name__)
# Adjust origins as needed. For development, ensure your frontend's origin is listed.
  # Allows all for broad testing
CORS(app, resources={r"/*": {"origins": ["http://localhost:5500", "http://127.0.0.1:5500"]}}, supports_credentials=True)
print("✅ Flask App initialized with CORS.")

# === GEMINI TASK EXTRACTOR ===
def extract_tasks_with_gemini(transcript_text_value: str, meeting_date_value: str):
    if not model:
        print("❌ Gemini model not initialized. Cannot extract tasks.")
        return []
    prompt = f"""You are an AI assistant specialized in extracting **explicitly committed and actionable tasks** from IT meeting transcripts.
The meeting date for the following transcript is: **{meeting_date_value}**.

Transcript:
{transcript_text_value}

Output format should be a valid JSON array of objects. Each object must represent a single task and strictly follow this structure:
[
  {{"task": "Description of the task", "assignee": "Person responsible (or 'Unassigned')", "deadline": "YYYY-MM-DD (or empty string if not specified)"}}
]
If no tasks are found, output an empty array [].
"""
    try:
        response = model.generate_content(prompt)
        data = response.text.strip()
        print(f"🧪 Gemini raw response text:\n{data}")

        # Try to find the JSON part, often enclosed in ```json ... ```
        match = re.search(r'```json\s*([\s\S]*?)\s*```|(\[[\s\S]*\])', data, re.MULTILINE)
        json_string = None
        if match:
            json_string = match.group(1) or match.group(2) # group(1) for ```json```, group(2) for direct array

        if not json_string:
            # Fallback: if the whole string might be the JSON array
            if data.startswith('[') and data.endswith(']'):
                json_string = data
            else:
                print("❌ No clear JSON array found in Gemini response.")
                return []
        
        print(f"🔬 Attempting to parse extracted JSON string: {json_string}")
        parsed_tasks = json.loads(json_string)
        if not isinstance(parsed_tasks, list):
            print(f"❌ Parsed JSON is not a list: {type(parsed_tasks)}")
            return []
        
        # Validate structure of each task (optional but good)
        validated_tasks = []
        for t in parsed_tasks:
            if isinstance(t, dict) and "task" in t:
                validated_tasks.append({
                    "task": t.get("task"),
                    "assignee": t.get("assignee", "Unassigned"),
                    "deadline": t.get("deadline", "")
                })
            else:
                print(f"⚠️ Skipping invalid task structure from Gemini: {t}")
        return validated_tasks

    except json.JSONDecodeError as je:
        print(f"❌ Gemini JSON Decode Error: {je}. Attempted to parse: {json_string if 'json_string' in locals() else data}")
        return []
    except Exception as e:
        print(f"❌ Gemini General Error in extract_tasks_with_gemini: {e}")
        traceback.print_exc()
        return []

# === /UPLOAD ENDPOINT ===
@app.route("/upload", methods=["POST", "OPTIONS"])
def upload_transcript():
    if request.method == "OPTIONS":
        return '', 204 # Handle preflight
    if not db:
        return jsonify({"message": "❌ Database not initialized. Cannot process upload."}), 500

    if 'file' not in request.files:
        return jsonify({"message": "No file part in the request."}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"message": "No selected file."}), 400

    try:
        print(f"📄 Processing uploaded file: {file.filename}")
        content = file.read().decode("utf-8")
        meeting_date = request.form.get("meeting_date", datetime.date.today().isoformat()) # Default to today
        
        tasks_from_gemini = extract_tasks_with_gemini(content, meeting_date)

        if not tasks_from_gemini: # Check if the list is empty or None
            return jsonify({"message": "No valid tasks were extracted by Gemini from the transcript."}), 200

        action = request.form.get('action')
        if not action:
            return jsonify({"message": "❌ Missing 'action' in form data."}), 400

        timestamp = firestore.SERVER_TIMESTAMP

        if action == 'personalTasks':
            added_count = 0
            for t_gemini in tasks_from_gemini:
                task_title = t_gemini.get("task", "Untitled Task from Transcript")
                normalized_task = {
                    "title": task_title,
                    "description": t_gemini.get("description", ""), # Gemini output might not have this yet
                    "assignee": t_gemini.get("assignee", ""),
                    "due_date": t_gemini.get("deadline", ""),
                    "completed": False,
                    "deleted": False,
                    "created_at": timestamp,
                    "source": "transcript"
                }
                db.collection("personal_tasks").add(normalized_task)
                added_count += 1
            print(f"✅ Added {added_count} task(s) to personal tasks from transcript.")
            return jsonify({"message": f"✅ Added {added_count} task(s) to personal tasks."}), 200

        elif action == 'newList':
            list_name = request.form.get('new_list_name')
            if not list_name: # Ensure list_name is provided
                list_name = f"Transcript Tasks - {secure_filename(file.filename)} - {datetime.date.today().isoformat()}"
            
            list_ref = db.collection("shared_lists").document()
            list_ref.set({"name": list_name, "created_at": timestamp, "deleted": False})
            
            added_count = 0
            for t_gemini in tasks_from_gemini:
                normalized_task = {
                    "title": t_gemini.get("task", "Untitled Task from Transcript"),
                    "description": t_gemini.get("description", ""),
                    "assignee": t_gemini.get("assignee", ""),
                    "due_date": t_gemini.get("deadline", ""),
                    "status": "todo",
                    "deleted": False,
                    "completed": False,
                    "created_at": timestamp
                }
                list_ref.collection("tasks").add(normalized_task)
                added_count +=1
            print(f"✅ Created new list '{list_name}' (ID: {list_ref.id}) with {added_count} task(s).")
            return jsonify({"message": f"✅ Created new list '{list_name}' with {added_count} task(s).", "new_list_id": list_ref.id, "list_name": list_name}), 200

        elif action == 'existingList':
            list_id = request.form.get("list_id")
            if not list_id:
                 return jsonify({"message": "❌ Missing 'list_id' for adding tasks to existing list."}), 400
            
            list_ref = db.collection("shared_lists").document(list_id)
            list_doc = list_ref.get()
            if not list_doc.exists:
                return jsonify({"message": f"❌ List with ID '{list_id}' not found."}), 404
            
            added_count = 0
            for t_gemini in tasks_from_gemini:
                normalized_task = {
                    "title": t_gemini.get("task", "Untitled Task from Transcript"),
                    "description": t_gemini.get("description", ""),
                    "assignee": t_gemini.get("assignee", ""),
                    "due_date": t_gemini.get("deadline", ""),
                    "status": "todo",
                    "deleted": False,
                    "completed": False,
                    "created_at": timestamp
                }
                list_ref.collection("tasks").add(normalized_task)
                added_count += 1
            print(f"✅ Added {added_count} task(s) to existing list ID: {list_id}.")
            return jsonify({"message": f"✅ Added {added_count} task(s) to existing list."}), 200

        else:
            print(f"⚠️ Invalid action type received in /upload: {action}")
            return jsonify({"message": f"❌ Invalid action type: {action}."}), 400

    except Exception as e:
        print(f"🔥❌ /upload Error: {str(e)}")
        traceback.print_exc()
        return jsonify({"message": f"❌ Server error during upload: {str(e)}"}), 500

# === /CREATE-TASK ENDPOINT ===
@app.route("/create-task", methods=["POST", "OPTIONS"])
def create_task():
    if request.method == "OPTIONS":
        return '', 204
    if not db:
        return jsonify({"message": "❌ Database not initialized. Cannot create task."}), 500

    try:
        data = request.get_json()
        if not data:
            return jsonify({"message": "❌ No JSON data received."}), 400

        # Accommodate 'task' or 'title' from frontend, default to "Untitled Task"
        title = data.get("task", data.get("title", "Untitled Task"))
        # Accommodate 'deadline' or 'due_date' from frontend
        due_date = data.get("deadline", data.get("due_date", ""))

        task_payload = {
            "title": title,
            "description": data.get("description", ""),
            "assignee": data.get("assignee", ""),
            "due_date": due_date,
            "status": data.get("status", "todo"),
            "deleted": False,
            "completed": data.get("completed", False), # Default to False if not provided
            "created_at": firestore.SERVER_TIMESTAMP
        }

        task_type = data.get("type") # Ensure this is defined from the payload

        if task_type == "personal":
            doc_ref = db.collection("personal_tasks").add(task_payload)
            print(f"✅ Personal task created. ID: {doc_ref[1].id if isinstance(doc_ref, tuple) else 'N/A'}")
            return jsonify({"message": "✅ Personal task created successfully.", "id": doc_ref[1].id if isinstance(doc_ref, tuple) else None}), 201
        elif task_type == "shared":
            list_id = data.get("list_id")
            if not list_id:
                return jsonify({"message": "❌ Missing 'list_id' for shared task."}), 400
            
            # Verify list exists
            list_doc_ref = db.collection("shared_lists").document(list_id)
            if not list_doc_ref.get().exists:
                 return jsonify({"message": f"❌ Shared list with ID '{list_id}' not found."}), 404

            doc_ref = list_doc_ref.collection("tasks").add(task_payload)
            print(f"✅ Shared task created in list {list_id}. ID: {doc_ref[1].id if isinstance(doc_ref, tuple) else 'N/A'}")
            return jsonify({"message": "✅ Shared task created successfully.", "id": doc_ref[1].id if isinstance(doc_ref, tuple) else None}), 201
        else:
            # task_type variable will hold the incorrect type or None here
            print(f"⚠️ Invalid task type received in /create-task: {task_type}")
            return jsonify({"message": f"❌ Invalid task type: {task_type}."}), 400

    except Exception as e:
        print(f"🔥❌ /create-task Error: {e}")
        traceback.print_exc()
        return jsonify({"error": "Failed to create task.", "details": str(e)}), 500

# === /TASKS ENDPOINT ===
@app.route("/tasks", methods=["GET", "OPTIONS"])
def get_tasks():
    if request.method == "OPTIONS":
        return '', 204
    if not db:
        return jsonify({"message": "❌ Database not initialized. Cannot fetch tasks."}), 500

    print("📥 /tasks endpoint hit.")
    try:
        personal_tasks_data = []
        personal_tasks_query = db.collection("personal_tasks").where(
            filter=firestore.FieldFilter("deleted", "==", False)
        )
        for doc in personal_tasks_query.stream():
            task = doc.to_dict()
            if task:
                task["id"] = doc.id
                personal_tasks_data.append(task)
        print(f"✅ Retrieved {len(personal_tasks_data)} personal tasks.")

        shared_lists_data = []
        shared_lists_query = db.collection("shared_lists").where(
            filter=firestore.FieldFilter("deleted", "==", False) # Assuming lists can be soft-deleted
        )
        for list_doc in shared_lists_query.stream():
            list_data = list_doc.to_dict()
            if not list_data:
                print(f"⚠️ Skipped a shared list document with no data. ID: {list_doc.id}")
                continue

            list_id = list_doc.id
            list_name = list_data.get("name", "Unnamed List")
            print(f"📄 Processing Shared list: {list_name} (ID: {list_id})")

            current_list_tasks = []
            tasks_query = db.collection("shared_lists").document(list_id).collection("tasks").where(
                filter=firestore.FieldFilter("deleted", "==", False)
            )
            for task_doc in tasks_query.stream():
                task_data = task_doc.to_dict()
                if task_data:
                    task_data["id"] = task_doc.id
                    current_list_tasks.append(task_data)
            
            shared_lists_data.append({
                "id": list_id,
                "name": list_name,
                "tasks": current_list_tasks # This should be an array of task objects
            })
            print(f"  ➡️ Found {len(current_list_tasks)} tasks for list '{list_name}'.")
        print(f"✅ Retrieved {len(shared_lists_data)} shared lists.")

        response_data = {
            "personal_tasks": personal_tasks_data,
            "shared_lists": shared_lists_data
        }
        return jsonify(response_data), 200

    except Exception as e:
        print("🔥❌❌❌ /tasks Unhandled Exception ❌❌❌🔥")
        print(f"Error Type: {type(e).__name__}")
        print(f"Error Message: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": "An internal server error occurred while fetching tasks.", "details": str(e)}), 500

# === /CREATE-LIST ENDPOINT ===
@app.route("/create-list", methods=["POST", "OPTIONS"])
def create_list():
    if request.method == "OPTIONS":
        return '', 204
    if not db:
        return jsonify({"message": "❌ Database not initialized. Cannot create list."}), 500
    try:
        data = request.get_json()
        if not data or not data.get("name"):
            return jsonify({"message": "❌ List name is required in JSON payload."}), 400
        
        list_name = data["name"]
        new_list_payload = {
            "name": list_name,
            "created_at": firestore.SERVER_TIMESTAMP,
            "deleted": False # Initialize as not deleted
        }
        # Add the new list to Firestore
        update_time, list_ref = db.collection("shared_lists").add(new_list_payload)
        # list_ref is a DocumentReference
        
        created_list_data = new_list_payload.copy()
        created_list_data["id"] = list_ref.id
        # For created_at, firestore.SERVER_TIMESTAMP is a sentinel.
        # If you need the actual timestamp in the response, you'd typically re-fetch the doc or use update_time.
        # For simplicity, we'll send what we have. Frontend might re-fetch tasks anyway.
        created_list_data["created_at"] = update_time.isoformat() if update_time else None


        print(f"✅ Shared list '{list_name}' created with ID: {list_ref.id}")
        return jsonify({
            "message": f"✅ Shared list '{list_name}' created successfully.",
            "list": created_list_data,  # Sending back the created list object
            "new_list_id": list_ref.id # For compatibility with some frontend logic
        }), 201

    except Exception as e:
        print(f"🔥❌ /create-list Error: {e}")
        traceback.print_exc()
        return jsonify({"error": "Failed to create list.", "details": str(e)}), 500

# === Add other CRUD endpoints here as needed (update, delete for personal tasks, shared tasks, and lists) ===
# Example: Update Personal Task
@app.route("/update-personal-task/<task_id>", methods=["PUT", "OPTIONS"])
def update_personal_task(task_id):
    if request.method == "OPTIONS": return '', 204
    if not db: return jsonify({"message": "❌ DB not initialized."}), 500
    try:
        data = request.get_json()
        if not data: return jsonify({"message": "Missing data"}), 400
        
        task_ref = db.collection("personal_tasks").document(task_id)
        if not task_ref.get().exists: return jsonify({"message": "Personal task not found"}), 404
        
        # Prepare updates, only include fields that are present in the payload
        updates = {}
        if "title" in data: updates["title"] = data["title"]
        if "task" in data: updates["title"] = data["task"] # Accommodate 'task' as title
        if "description" in data: updates["description"] = data["description"]
        if "due_date" in data: updates["due_date"] = data["due_date"]
        if "deadline" in data: updates["due_date"] = data["deadline"] # Accommodate 'deadline'
        if "completed" in data: updates["completed"] = bool(data["completed"])
        
        if not updates: return jsonify({"message": "No update fields provided"}), 400
            
        updates["updated_at"] = firestore.SERVER_TIMESTAMP
        task_ref.update(updates)
        return jsonify({"message": f"✅ Personal task {task_id} updated."}), 200
    except Exception as e:
        print(f"🔥❌ /update-personal-task Error: {e}"); traceback.print_exc()
        return jsonify({"error": "Failed to update personal task.", "details": str(e)}), 500

# Example: Delete Personal Task
@app.route("/delete-personal-task/<task_id>", methods=["DELETE", "OPTIONS"])
def delete_personal_task(task_id):
    if request.method == "OPTIONS": return '', 204
    if not db: return jsonify({"message": "❌ DB not initialized."}), 500
    try:
        task_ref = db.collection("personal_tasks").document(task_id)
        if not task_ref.get().exists: return jsonify({"message": "Personal task not found"}), 404
        
        # Soft delete:
        task_ref.update({"deleted": True, "deleted_at": firestore.SERVER_TIMESTAMP})
        # Or hard delete:
        # task_ref.delete()
        return jsonify({"message": f"✅ Personal task {task_id} marked as deleted."}), 200
    except Exception as e:
        print(f"🔥❌ /delete-personal-task Error: {e}"); traceback.print_exc()
        return jsonify({"error": "Failed to delete personal task.", "details": str(e)}), 500

# Example: Update Shared Task
@app.route("/update-shared-task/<list_id>/<task_id>", methods=["PUT", "OPTIONS"])
def update_shared_task(list_id, task_id):
    if request.method == "OPTIONS": return '', 204
    if not db: return jsonify({"message": "❌ DB not initialized."}), 500
    try:
        data = request.get_json()
        if not data: return jsonify({"message": "Missing data"}), 400

        task_ref = db.collection("shared_lists").document(list_id).collection("tasks").document(task_id)
        if not task_ref.get().exists: return jsonify({"message": "Shared task not found"}), 404

        updates = {}
        if "title" in data: updates["title"] = data["title"]
        if "task" in data: updates["title"] = data["task"]
        if "description" in data: updates["description"] = data["description"]
        if "due_date" in data: updates["due_date"] = data["due_date"]
        if "deadline" in data: updates["due_date"] = data["deadline"]
        if "assignee" in data: updates["assignee"] = data["assignee"]
        if "status" in data: updates["status"] = data["status"]
        if "completed" in data: # If 'completed' is sent, adjust status accordingly
            updates["completed"] = bool(data["completed"])
            if updates["completed"] and data.get("status") != "completed":
                 updates["status"] = "completed"
            elif not updates["completed"] and data.get("status") == "completed":
                 updates["status"] = "todo" # Or previous status if tracked

        if not updates: return jsonify({"message": "No update fields provided"}), 400

        updates["updated_at"] = firestore.SERVER_TIMESTAMP
        task_ref.update(updates)
        return jsonify({"message": f"✅ Shared task {task_id} in list {list_id} updated."}), 200
    except Exception as e:
        print(f"🔥❌ /update-shared-task Error: {e}"); traceback.print_exc()
        return jsonify({"error": "Failed to update shared task.", "details": str(e)}), 500

# Example: Delete Shared Task
@app.route("/delete-shared-task/<list_id>/<task_id>", methods=["DELETE", "OPTIONS"])
def delete_shared_task(list_id, task_id):
    if request.method == "OPTIONS": return '', 204
    if not db: return jsonify({"message": "❌ DB not initialized."}), 500
    try:
        task_ref = db.collection("shared_lists").document(list_id).collection("tasks").document(task_id)
        if not task_ref.get().exists: return jsonify({"message": "Shared task not found"}), 404
        
        task_ref.update({"deleted": True, "deleted_at": firestore.SERVER_TIMESTAMP})
        return jsonify({"message": f"✅ Shared task {task_id} in list {list_id} marked as deleted."}), 200
    except Exception as e:
        print(f"🔥❌ /delete-shared-task Error: {e}"); traceback.print_exc()
        return jsonify({"error": "Failed to delete shared task.", "details": str(e)}), 500

# Example: Delete Shared List (Soft Delete)
@app.route("/delete-list/<list_id>", methods=["DELETE", "OPTIONS"])
def delete_list(list_id):
    if request.method == "OPTIONS": return '', 204
    if not db: return jsonify({"message": "❌ DB not initialized."}), 500
    try:
        list_ref = db.collection("shared_lists").document(list_id)
        if not list_ref.get().exists: return jsonify({"message": "Shared list not found"}), 404
            
        list_ref.update({"deleted": True, "deleted_at": firestore.SERVER_TIMESTAMP})
        # Optionally, you might want to mark all tasks in this list as deleted too,
        # or handle this via application logic/security rules.
        return jsonify({"message": f"✅ Shared list {list_id} marked as deleted."}), 200
    except Exception as e:
        print(f"🔥❌ /delete-list Error: {e}"); traceback.print_exc()
        return jsonify({"error": "Failed to delete shared list.", "details": str(e)}), 500

@app.route("/")
def index():
    return jsonify({"message": "🚀 TaskSteer backend is running."}), 200

# === RUN SERVER ===
if __name__ == "__main__":
    print("🚀 Starting Flask server...")
    # Using 0.0.0.0 makes the server accessible on your local network,
    # which is often needed for ngrok to connect properly.
    app.run(host="0.0.0.0", port=8080, debug=True)