#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  انتشار کامل پلتفرم KPI — یک دستور، همه مراحل
#
#  استفاده:
#     bash release.sh v1.4.0        # با شماره نسخه
#     bash release.sh               # نسخه را خودکار از آخرین تگ + ۱ می‌سازد
#
#  مراحل:
#     ۱. چک تمیز بودن گیت (اگر تغییرات commitنشده باشد، خودکار commit می‌کند)
#     ۲. commit + push به GitHub با تگ نسخه
#     ۳. build ایمیج‌های Docker
#     ۴. tag + push به Docker Hub (نسخه‌دار + latest)
#     ۵. حذف ایمیج‌های قدیمی از محیط لوکال
#     ۶. اجرای مجدد stack با نسخه جدید و بررسی سلامت
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ─── پیکربندی ───
GH_USER="meysam8498"
REPO_NAME="hr-kpi-platform"
DOCKER_USER="meysam8498"
IMAGE_NAME="hr-kpi-platform"

# ─── تعیین نسخه ───
if [[ $# -ge 1 ]]; then
  VERSION="$1"
else
  LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "v1.3.0")
  MINOR=$(echo "$LAST_TAG" | sed -E 's/^v[0-9]+\.([0-9]+)\..*/\1/')
  MAJOR=$(echo "$LAST_TAG" | sed -E 's/^v([0-9]+)\..*/\1/')
  VERSION="v${MAJOR}.$((MINOR + 1)).0"
  echo "ℹ  نسخه از آخرین تگ ساخته شد: ${VERSION}"
fi

step() { echo ""; echo "═══ $1 ═══"; }

# ─── ۱) گیت: commit و push ───
step "۱/۶  گیت — commit و push با تگ ${VERSION}"

if ! git diff-index --quiet HEAD -- 2>/dev/null || [[ -n "$(git ls-files --others --exclude-standard)" ]]; then
  git add -A
  git commit -m "Release ${VERSION}

🤖 Generated with Codebuff
Co-Authored-By: Codebuff <noreply@codebuff.com>" \
    || { echo "✗ commit ناموفق بود"; exit 1; }
  echo "✓ تغییرات commit شد"
else
  echo "ℹ  تغییرات commitنشده وجود ندارد"
fi

# تگ نسخه (اگر از قبل روی HEAD نیست)
if git rev-parse "${VERSION}" >/dev/null 2>&1; then
  echo "ℹ  تگ ${VERSION} از قبل exists — منتقل می‌شود به HEAD"
  git tag -f "${VERSION}" HEAD
else
  git tag "${VERSION}"
fi

# push — تگ‌ها جدا از main تا خطای scope کل push را نسوزاند
git push origin "HEAD:refs/heads/main" \
  || { echo "✗ push main ناموفق — دستی اجرا کنید: git push origin main"; exit 1; }
git push origin "${VERSION}" \
  || echo "⚠  push تگ ${VERSION} ناموفق (مثلاً scope توکن) — بعداً اجرا کنید: git push origin ${VERSION}"
echo "✓ GitHub: https://github.com/${GH_USER}/${REPO_NAME}"

# ─── ۲) Docker build ───
step "۲/۶  ساخت ایمیج‌های Docker"
docker compose build
echo "✓ build کامل شد"

# ─── ۳) Tag + push ───
step "۳/۶  tag و push به Docker Hub"
docker tag kpi-calc-backend:latest  "${DOCKER_USER}/${IMAGE_NAME}:backend-${VERSION}"
docker tag kpi-calc-frontend:latest "${DOCKER_USER}/${IMAGE_NAME}:frontend-${VERSION}"
docker tag kpi-calc-backend:latest  "${DOCKER_USER}/${IMAGE_NAME}:backend-latest"
docker tag kpi-calc-frontend:latest "${DOCKER_USER}/${IMAGE_NAME}:frontend-latest"

push_retry() {  # push با ۳ بار تلاش (خطاهای TLS موقت رایج است)
  local tag="$1" n=0
  until docker push "$tag" 2>/dev/null | tail -1 | grep -q "digest:"; do
    n=$((n + 1))
    [[ $n -ge 3 ]] && { echo "✗ push ${tag} بعد از ۳ تلاش ناموفق"; return 1; }
    echo "⚠  تلاش ${n} ناموفق — ۵ ثانیه بعد دوباره..."
    sleep 5
  done
  echo "✓ pushed: ${tag}"
}

push_retry "${DOCKER_USER}/${IMAGE_NAME}:backend-${VERSION}"
push_retry "${DOCKER_USER}/${IMAGE_NAME}:frontend-${VERSION}"
push_retry "${DOCKER_USER}/${IMAGE_NAME}:backend-latest"
push_retry "${DOCKER_USER}/${IMAGE_NAME}:frontend-latest"

# ─── ۴) حذف نسخه‌های قدیمی لوکال ───
step "۴/۶  حذف ایمیج‌های قدیمی لوکال"
docker images --format "{{.Repository}}:{{.Tag}}" \
  | grep -E "^${DOCKER_USER}/${IMAGE_NAME}:(backend|frontend)-v" \
  | grep -v "${VERSION}" \
  | while read -r img; do
      docker rmi "$img" > /dev/null 2>&1 && echo "  حذف شد: ${img}"
    done
docker image prune -f > /dev/null 2>&1 || true
echo "✓ پاکسازی کامل شد"

# ─── ۵) اجرای stack جدید ───
step "۵/۶  اجرای stack با نسخه جدید"
docker compose up -d --build
echo "✓ stack بالا آمد — انتظار برای health check..."

# ─── ۶) بررسی سلامت ───
step "۶/۶  بررسی سلامت"
ok=1
for i in $(seq 1 12); do
  sleep 5
  BACKEND=$(docker inspect --format '{{.State.Health.Status}}' kpi-calc-backend-1 2>/dev/null || echo "missing")
  FRONTEND=$(docker inspect --format '{{.State.Health.Status}}' kpi-calc-frontend-1 2>/dev/null || echo "missing")
  if [[ "$BACKEND" == "healthy" && "$FRONTEND" == "healthy" ]]; then ok=0; break; fi
  echo "  ... backend=${BACKEND} frontend=${FRONTEND}"
done

if [[ $ok -eq 0 ]]; then
  echo "✓ هر دو سرویس healthy هستند"
else
  echo "⚠  سرویس‌ها healthy نشدند — لاگ: docker compose logs"
fi

LOGIN=$(curl -s --max-time 8 -o /dev/null -w "%{http_code}" http://localhost:8000/health || echo "000")
FRONT=$(curl -s --max-time 10 -o /dev/null -w "%{http_code}" http://localhost:3000/ || echo "000")

echo ""
echo "════════════════════════════════════════════"
echo "✅ انتشار ${VERSION} کامل شد"
echo "   GitHub    : https://github.com/${GH_USER}/${REPO_NAME}  (تگ ${VERSION})"
echo "   Docker Hub: ${DOCKER_USER}/${IMAGE_NAME}:{backend,frontend}-${VERSION}"
echo "   App       : http://localhost:3000   (HTTP ${FRONT})"
echo "   API       : http://localhost:8000/health  (HTTP ${LOGIN})"
echo "════════════════════════════════════════════"
