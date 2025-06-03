from flask import Flask, request, jsonify
from flask_cors import CORS
from firebase_admin import credentials, firestore, initialize_app

app = Flask(__name__)
CORS(app)

# Load your service account key
cred = credentials.Certificate("serviceAccountKey.json")
initialize_app(cred)
db = firestore.client()

@app.route('/add-task', methods=['POST'])
def add_task():
    data = request.json
    task = {
        'title': data.get('title'),
        'description': data.get('description', ''),
        'dueDate': data.get('dueDate'),
        'completed': False
    }
    db.collection('tasks').add(task)
    return jsonify({"message": "Task added successfully!"}), 200

@app.route('/get-tasks', methods=['GET'])
def get_tasks():
    tasks = []
    docs = db.collection('tasks').stream()
    for doc in docs:
        task = doc.to_dict()
        task['id'] = doc.id
        tasks.append(task)
    return jsonify(tasks), 200

if __name__ == '__main__':
    app.run(debug=True)
