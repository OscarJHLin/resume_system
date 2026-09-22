#!/usr/bin/env bash
# Seed a demo resume and print export curl. Requires server on :8787.
set -euo pipefail
API="${API:-http://127.0.0.1:8787}"

curl -sS -X PUT "$API/api/profile" -H 'content-type: application/json' -d '{
  "name": "演示候选人",
  "phone": "13800000000",
  "email": "demo@example.com",
  "location": "上海",
  "summary": "本地优先简历组装原型",
  "education": [
    {"school": "示例大学", "degree": "本科", "major": "计算机科学", "timeRange": "2018-2022"}
  ]
}' | tee /tmp/resume-profile.json
echo

MOD=$(curl -sS -X POST "$API/api/modules" -H 'content-type: application/json' -d '{
  "category": "project",
  "title": "模块化简历系统",
  "subtitle": "个人项目",
  "projectType": "全栈",
  "timeRange": "2026.01 - 2026.09",
  "body": "内容库 + 快照组装 + DOCX 导出\n标签检索驱动投递方向",
  "tags": ["TypeScript", "简历", "本地优先"]
}')
echo "$MOD"
MOD_ID=$(node -e "console.log(JSON.parse(process.argv[1]).id)" "$MOD")

SKILL=$(curl -sS -X POST "$API/api/modules" -H 'content-type: application/json' -d '{
  "category": "skill",
  "title": "TypeScript / React",
  "body": "熟悉前端工程化与类型安全",
  "tags": ["TypeScript", "React"]
}')
SKILL_ID=$(node -e "console.log(JSON.parse(process.argv[1]).id)" "$SKILL")

RESUME=$(curl -sS -X POST "$API/api/resumes" -H 'content-type: application/json' -d '{"title":"S1演示简历"}')
echo "$RESUME"
RESUME_ID=$(node -e "console.log(JSON.parse(process.argv[1]).id)" "$RESUME")

curl -sS -X POST "$API/api/resumes/$RESUME_ID/placements" -H 'content-type: application/json' \
  -d "{\"section\":\"projects\",\"moduleId\":\"$MOD_ID\"}"
echo
curl -sS -X POST "$API/api/resumes/$RESUME_ID/placements" -H 'content-type: application/json' \
  -d "{\"section\":\"skills\",\"moduleId\":\"$SKILL_ID\"}"
echo

OUT="${OUT:-./data/s1-demo.docx}"
mkdir -p "$(dirname "$OUT")"
curl -sS -X POST "$API/api/resumes/$RESUME_ID/export" -o "$OUT"
echo "Wrote $OUT (resumeId=$RESUME_ID)"
ls -la "$OUT"
