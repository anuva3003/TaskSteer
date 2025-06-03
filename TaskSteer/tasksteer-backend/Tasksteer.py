from flask import Flask, request, jsonify
import os
import google.generativeai as genai
import json
from datetime import datetime
from dateparser.search import search_dates
from firebase_admin import credentials, firestore, initialize_app

app = Flask(__name__)

# Configure Gemini
genai.configure(api_key="YOUR_GEMINI_API_KEY")
model = genai.GenerativeModel("models/gemini-1.5-pro-latest")

# Firestore init
cred = credentials.Certificate("serviceAccountKey.json")
initialize_app(cred)
db = firestore.client()

def extract_tasks_with_gemini(transcript_text: str, meeting_date: str):
    prompt = f"""Extract actionable tasks from this IT meeting transcript dated {meeting_date}. Return only a JSON list like:
[
  {{"task": "...", "assignee": "...", "deadline": "..."}} 
]
Transcript:
{transcript_text}
"""
    try:
        response = model.generate_content(prompt)
        raw = response.text.strip()
        return json.loads(raw[raw.find("["):raw.rfind("]")+1])
    except Exception as e:
        print("Gemini error:", e)
        return []

@app.route("/upload", methods=["POST"])
def upload_transcript():
    file = request.files.get("file")
    if not file:
        return jsonify({"error": "No file uploaded"}), 400

    text = file.read().decode("utf-8")
    tasks = extract_tasks_with_gemini(text, datetime.today().strftime("%Y-%m-%d"))

    for task in tasks:
        task["createdAt"] = datetime.utcnow()
        db.collection("tasks").add(task)

    return jsonify({"message": f"{len(tasks)} tasks saved to Firestore", "tasks": tasks})

if __name__ == "__main__":
    app.run(debug=True)
