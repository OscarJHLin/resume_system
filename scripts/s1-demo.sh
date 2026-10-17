#!/usr/bin/env bash
# Seed a demo resume via profile card + modules. Requires server on :8787.
set -euo pipefail
API="${API:-http://127.0.0.1:8787}"

PROFILE=$(curl -sS -X POST "$API/api/profiles" -H 'content-type: application/json' -d '{
  "name": "演示候选人",
  "gender": "男",
  "phone": "13800000000",
  "email": "demo@example.com",
  "wechat": "wx_demo",
  "location": "上海",
  "summary": "本地优先简历组装原型",
  "education": [
    {"school": "示例大学", "degree": "本科", "major": "计算机科学", "startDate": "2018-09-01", "endDate": "2022-06-01"}
  ],
  "skills": [
    {"title": "编程语言", "body": "TypeScript、Python"}
  ],
  "tags": ["演示"]
}')
echo "$PROFILE"
PROFILE_ID=$(node -e "console.log(JSON.parse(process.argv[1]).id)" "$PROFILE")

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

RESUME=$(curl -sS -X POST "$API/api/resumes" -H 'content-type: application/json' -d "{\"title\":\"S1演示简历\",\"templateId\":\"default-v1\",\"profileId\":\"$PROFILE_ID\"}")
echo "$RESUME"
RESUME_ID=$(node -e "console.log(JSON.parse(process.argv[1]).id)" "$RESUME")

curl -sS -X POST "$API/api/resumes/$RESUME_ID/placements" -H 'content-type: application/json' \
  -d "{\"section\":\"projects\",\"moduleId\":\"$MOD_ID\"}"
echo

OUT="${OUT:-./data/s1-demo.docx}"
mkdir -p "$(dirname "$OUT")"
curl -sS -X POST "$API/api/resumes/$RESUME_ID/export" -o "$OUT"
echo "Wrote $OUT (resumeId=$RESUME_ID profileId=$PROFILE_ID)"
ls -la "$OUT"
