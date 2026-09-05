#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  انتشار پلتفرم KPI به GitHub و Docker Hub
#  برای اجرا:  bash release.sh
#  (یکبار قبل از اجرا، در ترمینال خود لاگین کنید — توضیح در پایین)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ─── پیکربندی ───
GH_USER="meysam8498"
REPO_NAME="hr-kpi-platform"
DOCKER_USER="meysam8498"
IMAGE_NAME="hr-kpi-platform"
VERSION="${1:-v1.0.1}"

echo "▶ انتشار نسخه ${VERSION} ..."

# ─── ۱) لاگین داکر هاب (اگر قبلاً انجام نشده) ───
echo ""
echo "▶ اگر وارد داکر هاب نشده‌اید، دستور زیر را جداگانه اجرا کنید:"
echo "    docker login -u ${DOCKER_USER}"
echo "   (و در مورد GitHub، از `gh auth login` یا یک Personal Access Token استفاده کنید.)"
echo ""

# ─── ۲) GitHub: ساخت ریپو و push با تگ ───
if command -v gh >/dev/null 2>&1; then
  echo "▶ ساخت ریپو و push به GitHub ..."
  gh repo create "${GH_USER}/${REPO_NAME}" --public --source . --remote origin --push || \
    echo "⚠  ریپو شاید از قبل وجود داشته باشد — تلاش برای push ساده:"
  git remote add origin "https://github.com/${GH_USER}/${REPO_NAME}.git" 2>/dev/null || true
  git push -u origin main || echo "⚠  push GitHub انجام نشد (لاگین gh را بررسی کنید)"
  git push origin "${VERSION}" || true
else
  echo "⚠  ابزار gh نصب نیست. دستورات GitHub را دستی اجرا کنید:"
  echo "    git remote add origin https://github.com/${GH_USER}/${REPO_NAME}.git"
  echo "    git push -u origin main"
  echo "    git push origin ${VERSION}"
fi

# ─── ۳) Docker: ساخت، تگ و push ───
echo "▶ ساخت ایمیج‌های Docker ..."
docker compose build

echo "▶ تگ‌زدن ایمیج‌ها ..."
docker tag kpi-calc-backend:latest  "${DOCKER_USER}/${IMAGE_NAME}:backend-${VERSION}"
docker tag kpi-calc-frontend:latest "${DOCKER_USER}/${IMAGE_NAME}:frontend-${VERSION}"
docker tag kpi-calc-backend:latest  "${DOCKER_USER}/${IMAGE_NAME}:backend-latest"
docker tag kpi-calc-frontend:latest "${DOCKER_USER}/${IMAGE_NAME}:frontend-latest"

echo "▶ push به Docker Hub ..."
docker push "${DOCKER_USER}/${IMAGE_NAME}:backend-${VERSION}"
docker push "${DOCKER_USER}/${IMAGE_NAME}:frontend-${VERSION}"
docker push "${DOCKER_USER}/${IMAGE_NAME}:backend-latest"
docker push "${DOCKER_USER}/${IMAGE_NAME}:frontend-latest"

echo ""
echo "✅ انتشار کامل شد."
echo "   GitHub:  https://github.com/${GH_USER}/${REPO_NAME}"
echo "   Docker:  ${DOCKER_USER}/${IMAGE_NAME}:{backend,frontend}-${VERSION}"
