import json

def parse_llm_json(response):
    try:
        cleaned = response.strip()
        cleaned = cleaned.replace("```json", "").replace("```", "")
        return json.loads(cleaned)
    except Exception:
        return {
            "error": "Invalid JSON",
            "raw": response
        }