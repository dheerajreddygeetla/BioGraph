import os
import json
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_URL = "https://api.openai.com/v1/chat/completions"

@app.route('/generate', methods=['POST'])
def generate():
    try:
        data = request.get_json()
        question = data.get('question')
        context = data.get('context', {'nodes': [], 'edges': []})
        
        if not question:
            return jsonify({'error': 'Question is required'}), 400
        
        context_str = build_context_string(context)
        
        system_prompt = (
            "You are a biomedical research assistant. "
            "Answer the user's question using ONLY the provided graph context. "
            "Cite the specific entities or relationships you used. "
            "If the context does not contain enough information, say that clearly. "
            "Provide a confidence score between 0 and 1 based on the strength of evidence."
        )
        user_prompt = f"""
Graph context (entities and relationships):
{context_str}

Question: {question}

Provide your answer, followed by a list of citations (entity names or relationship labels) and a confidence score (0-1).
Format your response as JSON with keys: "answer", "citations" (list), "confidence" (number).
"""
        
        headers = {
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "gpt-3.5-turbo",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": 0.2,
            "response_format": {"type": "json_object"}
        }
        
        response = requests.post(OPENAI_URL, headers=headers, json=payload)
        
        # Handle rate limit explicitly
        if response.status_code == 429:
            print("⚠️ OpenAI rate limit hit. Returning fallback response.")
            return jsonify({
                "answer": f"Based on the graph, Olaparib targets proteins (BRCA1 Protein) in the BRCA1 pathway. (Mock response – rate limit exceeded)",
                "citations": ["BRCA1", "BRCA1 Protein", "Olaparib", "Homologous Recombination Repair"],
                "confidence": 0.7
            })
        
        response.raise_for_status()
        result = response.json()
        
        content = result['choices'][0]['message']['content']
        try:
            parsed = json.loads(content)
        except json.JSONDecodeError:
            parsed = {
                "answer": content,
                "citations": [],
                "confidence": 0.5
            }
        
        return jsonify({
            "answer": parsed.get("answer", "No answer generated."),
            "citations": parsed.get("citations", []),
            "confidence": parsed.get("confidence", 0.5)
        })
    
    except requests.exceptions.RequestException as e:
        print(f"❌ OpenAI API error: {e}")
        return jsonify({"error": f"OpenAI API error: {str(e)}"}), 500
    except Exception as e:
        print(f"❌ Internal error: {e}")
        return jsonify({"error": str(e)}), 500

def build_context_string(context):
    nodes = context.get('nodes', [])
    edges = context.get('edges', [])
    lines = []
    lines.append("Entities:")
    for node in nodes:
        lines.append(f"- {node['name']} ({node['type']})")
    lines.append("\nRelationships:")
    for edge in edges:
        source = next((n for n in nodes if n['id'] == edge['source']), {}).get('name', edge['source'])
        target = next((n for n in nodes if n['id'] == edge['target']), {}).get('name', edge['target'])
        lines.append(f"- {source} --{edge['label']}--> {target}")
    return "\n".join(lines)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)