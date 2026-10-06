FROM node:24-bookworm-slim
ENV NODE_ENV=production PORT=8788 RAFFLE_DB=/data/raffle.sqlite RAFFLE_MAIL_MODE=disabled RAFFLE_LIVE_ENABLED=false
WORKDIR /app
COPY --chown=node:node integrations/raffle/production/*.cjs ./integrations/raffle/production/
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 8788
CMD ["node", "integrations/raffle/production/start.cjs"]
