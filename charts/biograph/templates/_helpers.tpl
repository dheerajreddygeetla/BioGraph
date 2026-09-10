{{/*
Common labels applied to every resource.
*/}}
{{- define "biograph.labels" -}}
app.kubernetes.io/part-of: biograph
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
{{- end }}

{{/*
Selector labels for a given service name.
Usage: {{ include "biograph.selectorLabels" (dict "name" "auth-service") }}
*/}}
{{- define "biograph.selectorLabels" -}}
app.kubernetes.io/name: {{ .name }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Full name helper.
*/}}
{{- define "biograph.fullname" -}}
{{ .Release.Name }}-{{ .Chart.Name }}
{{- end }}

{{/*
Environment variables common to all services.
*/}}
{{- define "biograph.commonEnv" -}}
- name: LOG_LEVEL
  value: "info"
- name: JWT_SECRET
  valueFrom:
    secretKeyRef:
      name: biograph-secrets
      key: jwt-secret
{{- end }}

{{/*
Database connection env vars.
*/}}
{{- define "biograph.dbEnv" -}}
- name: MONGO_URI
  value: "mongodb://mongo:27017/biograph"
- name: REDIS_HOST
  value: "redis"
- name: REDIS_PORT
  value: "6379"
- name: NEO4J_URI
  value: "bolt://neo4j:7687"
- name: NEO4J_USER
  value: "neo4j"
- name: NEO4J_PASSWORD
  valueFrom:
    secretKeyRef:
      name: biograph-secrets
      key: neo4j-password
- name: QDRANT_URL
  value: "http://qdrant:6333"
- name: QDRANT_API_KEY
  valueFrom:
    secretKeyRef:
      name: biograph-secrets
      key: qdrant-api-key
{{- end }}