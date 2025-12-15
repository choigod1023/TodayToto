FROM node:18-alpine AS builder
WORKDIR /app

# 의존성 설치
COPY package*.json ./
RUN npm ci

# 소스 복사 및 빌드
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app

# 런타임 의존성만 설치
COPY package*.json ./
RUN npm ci --omit=dev

# 빌드 산출물 복사
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

# 환경변수 (필요 시 .env 파일을 컨테이너 외부에서 주입)
ENV PORT=3001
EXPOSE 3001

CMD ["node", "dist/main.js"]

