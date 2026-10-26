# 🧪 Guía de Testing End-to-End — NeuroEdu IA

> Pasos exactos para verificar el sistema completo (3 servicios + DB).
> Sigue el orden. Si algo falla, ve a la sección **Troubleshooting**.

---

## 📦 0. Pre-requisitos (verificar UNA vez)

### 0.1 Servicios externos corriendo
PowerShell:
```powershell
# PostgreSQL en 5432
netstat -an | findstr ":5432"
# Debe mostrar: TCP 0.0.0.0:5432 ... LISTENING
```

Si NO está listening: arrancar servicio Windows:
```powershell
Get-Service postgresql-x64-18 | Start-Service
```

### 0.2 Base de datos `proydemo` creada
```powershell
# Usa el usuario postgres (sin password porque pg_hba.conf = trust)
psql -U postgres -h localhost -c "CREATE DATABASE proydemo;"
# Si ya existe: ERROR: database "proydemo" already exists  (OK, ignorar)
```

### 0.3 .env files presentes
```powershell
Test-Path apps\backend\.env       # debe ser True
Test-Path apps\ai-service\.env    # debe ser True
Test-Path Frontend\.env.local     # debe ser True
```

Si falta alguno:
```powershell
Copy-Item apps\backend\.env.example apps\backend\.env
Copy-Item apps\ai-service\.env.example apps\ai-service\.env
# Frontend\.env.local ya está
```

### 0.4 JWT secrets sincronizados
Backend `apps\backend\.env` y AI service `apps\ai-service\.env` deben tener el **mismo** `JWT_ACCESS_SECRET`. Verificar:
```powershell
Select-String "JWT_ACCESS_SECRET" apps\backend\.env, apps\ai-service\.env
```
Si difieren: copiar el del backend al ai-service.

---

## 🚀 1. Arrancar los 3 servicios

Abre **3 terminales separadas**.

### Terminal 1 — Backend NestJS (puerto 4000)
```powershell
cd C:\Users\angui\Documents\proyDemo\apps\backend
pnpm start:dev
```
Espera ver: `API listening on http://localhost:4000/api/v1`
✅ Visible Swagger: <http://localhost:4000/api/v1/docs>

### Terminal 2 — AI Service FastAPI (puerto 8000)
```powershell
cd C:\Users\angui\Documents\proyDemo\apps\ai-service
.\.venv\Scripts\python -m uvicorn src.main:app --reload --port 8000
```
Espera ver: `Uvicorn running on http://0.0.0.0:8000`
✅ Visible Swagger: <http://localhost:8000/api/v1/docs>

### Terminal 3 — Frontend Next.js (puerto 7000)
```powershell
cd C:\Users\angui\Documents\proyDemo\Frontend
pnpm dev
```
Espera ver: `Local: http://localhost:7000`

### Verificación rápida (Terminal 4)
```powershell
curl http://localhost:4000/api/v1/score/leaderboard   # backend OK (200 envelope)
curl http://localhost:8000/health                      # ai-service OK ({"status":"ok"})
curl -I http://localhost:7000/login                    # frontend OK (HTTP/1.1 200)
```

---

## 👤 2. Registro de usuario (UI)

1. Abre <http://localhost:7000>
2. Click **Iniciar sesión** → estás en `/login`
3. Click **Regístrate** → estás en `/register`
4. Llena:
   - **Nombre**: `Juan`
   - **Apellido**: `Tarifa`
   - **Email**: `test@neuroedu.ia`
   - **Contraseña**: `StrongP@ss123` (min 8, mayús, minús, dígito)
   - **Confirmar**: `StrongP@ss123`
   - **Términos**: ✅
5. Click **Crear cuenta**

**Resultado esperado**: redirect a `/dashboard` con sidebar visible.

**Verificar cookie httpOnly** (DevTools → Application → Cookies → localhost:7000):
- `neuroedu_access` (httpOnly ✓, SameSite=Lax)
- `neuroedu_refresh` (httpOnly ✓)

---

## 🎓 3. Promover usuario a TEACHER (necesario para crear quizzes)

Sprint 1 deja a todos como `USER`. Promueve via SQL:
```powershell
psql -U postgres -h localhost -d proydemo -c "UPDATE users SET role='TEACHER' WHERE email='test@neuroedu.ia';"
```

Después **cierra sesión y vuelve a entrar** (token nuevo con role TEACHER):
```powershell
# En navegador: hacer logout (botón en sidebar) y volver a login
```

---

## 📝 4. Crear un Quiz (vía API porque UI de creación es stub)

### 4.1 Obtener accessToken
```powershell
$body = '{"email":"test@neuroedu.ia","password":"StrongP@ss123"}'
$resp = Invoke-RestMethod -Uri "http://localhost:4000/api/v1/auth/login" `
  -Method POST -ContentType "application/json" -Body $body
$token = $resp.data.accessToken
Write-Host "Token: $token"
```

### 4.2 Crear quiz
```powershell
$quizBody = @'
{
  "title": "Capitales del mundo",
  "description": "Test rápido de geografía",
  "category": "geography",
  "difficulty": "medium",
  "timePerQuestionSeconds": 20,
  "questions": [
    {
      "text": "Capital de Francia",
      "type": "multiple_choice",
      "options": ["Paris", "Londres", "Berlin", "Madrid"],
      "correctAnswer": "Paris",
      "difficulty": "easy"
    },
    {
      "text": "Capital de Japón",
      "type": "multiple_choice",
      "options": ["Seúl", "Tokio", "Pekín", "Bangkok"],
      "correctAnswer": "Tokio",
      "difficulty": "medium"
    },
    {
      "text": "¿Roma es la capital de Italia?",
      "type": "true_false",
      "options": null,
      "correctAnswer": "True",
      "difficulty": "easy"
    }
  ]
}
'@
$quiz = Invoke-RestMethod -Uri "http://localhost:4000/api/v1/quiz" `
  -Method POST -ContentType "application/json" `
  -Headers @{Authorization="Bearer $token"} -Body $quizBody
$quizId = $quiz.data.id
Write-Host "Quiz ID: $quizId"
```

### 4.3 Publicar el quiz (para que aparezca en /quiz UI)
```powershell
psql -U postgres -h localhost -d proydemo -c "UPDATE quizzes SET is_published=true WHERE id='$quizId';"
```

---

## 🎮 5. Jugar el Quiz (UI)

1. Navega a <http://localhost:7000/quiz>
2. Debes ver una tarjeta **"Capitales del mundo"** con icono 🌍 y badge "Medio"
3. Click la tarjeta → `/quiz/<id>` (detalle)
4. Verifica: muestra "3 preguntas", "20s c/u", "1min aprox."
5. Click **Comenzar quiz →** → `/quiz/<id>/play`
6. **Pregunta 1**: aparece "Capital de Francia" con 4 opciones
7. Click **Paris** (la opción se resalta con borde violet)
8. Click **Responder**
9. Aparece: banner verde "Correcto · +X puntos"
10. Click **Siguiente →**
11. **Pregunta 2**: contesta **Tokio**
12. **Pregunta 3**: contesta **True**
13. Al terminar: redirect automático a `/quiz/<id>/results`
14. Verifica: emoji 🏆, "PERFECTO", score total, "Aciertos: 3/3 · Precision: 100%"

**Verificación backend** (eventos disparados):
- `QuizCompleted` → `SaveScoreUseCase` → fila en `scores` table
- `ScoreUpdated` → `CheckAchievementsUseCase` → filas en `achievements` (FIRST_QUIZ + PERFECT_SCORE + POINTS_1000 si superas)

```powershell
psql -U postgres -h localhost -d proydemo -c "SELECT user_id, points, accuracy FROM scores ORDER BY created_at DESC LIMIT 3;"
psql -U postgres -h localhost -d proydemo -c "SELECT code, title, unlocked_at FROM achievements ORDER BY unlocked_at DESC;"
```

---

## 🏆 6. Leaderboard

1. Click **🏆 Leaderboard** en sidebar → `/leaderboard`
2. Verifica tu fila: rank 🥇, userId (8 chars), totalPoints, 1 quiz, 100% precision

API directa:
```powershell
curl http://localhost:4000/api/v1/score/leaderboard
```

---

## 🤖 7. Calificación con IA (FastAPI Grading)

### 7.1 Test exact_match strategy
```powershell
$body = @{
  question_id = "q1"
  question_type = "multiple_choice"
  question_text = "Capital de Francia"
  correct_answer = "Paris"
  user_answer = "paris"
  language = "es"
  similarity_threshold = 0.75
} | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:8000/api/v1/grading/grade" `
  -Method POST -ContentType "application/json" `
  -Headers @{Authorization="Bearer $token"} -Body $body
```
**Esperado**: `score: 1.0, is_correct: true, strategy_used: "exact_match"`

### 7.2 Test similarity strategy (open_answer)
```powershell
$body = @{
  question_id = "q2"
  question_type = "open_answer"
  question_text = "Describe la fotosintesis"
  correct_answer = "Las plantas convierten luz solar en energia"
  user_answer = "Plantas usan luz del sol para hacer energia"
  similarity_threshold = 0.4
} | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:8000/api/v1/grading/grade" `
  -Method POST -ContentType "application/json" `
  -Headers @{Authorization="Bearer $token"} -Body $body
```
**Esperado**: `strategy_used: "similarity"`, score ~ 0.5-0.8 (lexical difflib fallback porque sentence-transformers no se cargó en Sprint 1.3).

### 7.3 Batch grading
```powershell
$body = '[{"question_id":"q1","question_type":"multiple_choice","question_text":"x","correct_answer":"A","user_answer":"a"},{"question_id":"q2","question_type":"true_false","question_text":"x","correct_answer":"True","user_answer":"true"}]'
Invoke-RestMethod -Uri "http://localhost:8000/api/v1/grading/batch" `
  -Method POST -ContentType "application/json" `
  -Headers @{Authorization="Bearer $token"} -Body $body
```
**Esperado**: array con 2 resultados, ambos `is_correct: true`.

---

## 💬 8. Feedback pedagógico (FastAPI Feedback)

### 8.1 Generar feedback
```powershell
$body = @{
  question_id = "q1"
  question_text = "Capital de Francia"
  correct_answer = "Paris"
  user_answer = "Berlin"
  topic = "geography"
  language = "es"
} | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:8000/api/v1/feedback/generate" `
  -Method POST -ContentType "application/json" `
  -Headers @{Authorization="Bearer $token"} -Body $body
```
**Esperado**:
- Si Ollama corriendo en `localhost:11434` con modelo `llama3.1`: respuesta generada por LLM real
- Si Ollama NO corriendo: fallback canned "Revisa el concepto clave..."
- `references` con 1-2 snippets del RAG

### 8.2 Análisis de debilidades
```powershell
$body = @{
  user_id = "test-user-123"
  topic_accuracy = @{
    geography = 0.4
    science = 0.85
    history = 0.55
  }
  threshold = 0.6
} | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:8000/api/v1/feedback/weaknesses" `
  -Method POST -ContentType "application/json" `
  -Headers @{Authorization="Bearer $token"} -Body $body
```
**Esperado**:
- `weak_topics`: [geography (0.4), history (0.55)]
- `strong_topics`: ["science"]

---

## 🧑‍🏫 9. Asistente Tutor IA (FastAPI Assistant)

### 9.1 Chat simple
```powershell
$body = @{
  message = "Explicame que es la fotosintesis"
  topic = "science"
} | ConvertTo-Json
$chat = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/assistant/chat" `
  -Method POST -ContentType "application/json" `
  -Headers @{Authorization="Bearer $token"} -Body $body
$chat
$sessionId = $chat.session_id
```
**Esperado**: `session_id` UUID, `reply` con texto del tutor, `history` con 2 turnos (user + assistant).

### 9.2 Continuar conversación
```powershell
$body = @{
  session_id = $sessionId
  message = "Dame un ejemplo concreto"
} | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:8000/api/v1/assistant/chat" `
  -Method POST -ContentType "application/json" `
  -Headers @{Authorization="Bearer $token"} -Body $body
```
**Esperado**: `history` ahora con 4 turnos (memoria conservada).

### 9.3 Leer conversación
```powershell
Invoke-RestMethod -Uri "http://localhost:8000/api/v1/assistant/conversation/$sessionId" `
  -Headers @{Authorization="Bearer $token"}
```

---

## 🔁 10. Flujo integrado NestJS → FastAPI

Con todos los servicios arriba, el flujo de submit-answer YA puede usar FastAPI:
- `AIClientService` en NestJS llama a `/grading/grade` al recibir respuesta
- Si FastAPI cae, fallback local `exact_match_fallback_nestjs`

⚠️ **Nota**: en Sprint 2.1 la integración aún usa scoring local de NestJS por defecto. Para activar grading via FastAPI se requiere editar `SubmitAnswerUseCase` (lo vemos en Sprint 4).

---

## 🩺 Troubleshooting

### "Unable to connect to the database"
```powershell
# Verificar postgres
Get-Service postgresql-x64-18
# Si Stopped: Start-Service
# Verificar password en .env: si pg_hba.conf=trust, cualquier password funciona
```

### "Missing Authorization header" en FastAPI
- Verifica que `JWT_ACCESS_SECRET` sea **idéntico** en backend `.env` y ai-service `.env`
- El token expira en 15 min — re-login si pasa tiempo

### Frontend en bucle de redirect a /login
- Cookie `neuroedu_access` ausente → repite el login
- Backend caído → frontend no puede setear cookie (ver Terminal 1)

### "No se pudo cargar la lista de quizzes"
- Backend caído o BD vacía
- Crear quiz vía API (sección 4) y publicarlo

### Ollama LLM responde fallback
```powershell
# Verificar Ollama corriendo
curl http://localhost:11434/api/tags
# Si no: instalar ollama + ollama pull llama3.1 + ollama serve
```

### Port 7000/4000/8000 ya en uso
```powershell
netstat -ano | findstr ":7000"
# Kill el PID resultante:
Stop-Process -Id <PID> -Force
```

---

## ✅ Checklist final

- [ ] PostgreSQL 5432 listening
- [ ] DB `proydemo` creada
- [ ] Backend 4000 → `/api/v1/docs` carga
- [ ] AI Service 8000 → `/api/v1/docs` carga
- [ ] Frontend 7000 → `/login` carga con paleta NeuroEdu
- [ ] Registro de usuario funciona
- [ ] Cookies httpOnly visibles en DevTools
- [ ] Promoción a TEACHER via SQL
- [ ] Creación de quiz via API
- [ ] UI muestra quiz en `/quiz`
- [ ] Juego completo end-to-end
- [ ] Resultados muestran score correcto
- [ ] Leaderboard refleja el score
- [ ] Achievements registrados en DB
- [ ] FastAPI grading/grade responde
- [ ] FastAPI grading/batch responde
- [ ] FastAPI feedback/generate responde
- [ ] FastAPI assistant/chat mantiene sesión

---

## 📋 Estado conocido

| Componente | Estado |
|---|---|
| Auth (register/login/refresh/logout) | ✅ funcional |
| Quiz CRUD + sessions | ✅ funcional |
| Leaderboard ISR 60s | ✅ funcional |
| Achievements rules engine | ✅ funcional |
| Grading (exact_match + similarity lexical) | ✅ funcional |
| Grading (similarity SBERT) | ⏸ requiere `pip install sentence-transformers` + descarga modelo |
| Feedback (Ollama LLM) | ⏸ requiere Ollama + modelo descargado |
| Feedback (fallback canned) | ✅ funcional |
| Assistant chat | ✅ funcional (con o sin Ollama) |
| NestJS → FastAPI grading proxy | ✅ módulo listo, no wired aún a SubmitAnswer (Sprint 4) |
| OAuth Google/GitHub | ❌ Sprint 4 |
| Real-time SSE notifications | ❌ Sprint 4 |
| Sidebar/Navbar UI completos | ⏸ stub funcional, mejorar Sprint 4 |
| Create Quiz UI | ❌ stub (usar API directa) |
| Frontend assistant chat UI | ❌ stub (API funciona) |

