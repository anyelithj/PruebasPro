from locust import HttpUser, task, between

class AIServiceUser(HttpUser):
    wait_time = between(1, 5)

    @task(3)
    def grade_answer(self):
        """Simula la calificación de una respuesta abierta."""
        self.client.post("/grading/grade", json={
            "question_id": "q_perf_1",
            "question_type": "OPEN_ANSWER",
            "question_text": "¿Qué es la fotosíntesis?",
            "correct_answer": "Proceso de las plantas para convertir luz en energía química.",
            "user_answer": "Es cuando las plantas usan el sol para comer."
        })

    @task(2)
    def get_feedback(self):
        """Simula la solicitud de feedback pedagógico."""
        self.client.post("/feedback/generate", json={
            "question_text": "¿Cómo resolver una ecuación de primer grado?",
            "correct_answer": "Despejando la incógnita x.",
            "user_answer": "No sé cómo hacerlo.",
            "context": "Estudiante de secundaria con dificultades en álgebra."
        })

    @task(1)
    def analyze_weaknesses(self):
        """Simula el análisis de debilidades."""
        self.client.post("/feedback/analyze-weaknesses", json={
            "history": [
                {"topic": "Biología", "score": 0.5},
                {"topic": "Física", "score": 0.3},
                {"topic": "Química", "score": 0.9}
            ]
        })

    def on_start(self):
        """Opcional: Login o configuración inicial."""
        pass
