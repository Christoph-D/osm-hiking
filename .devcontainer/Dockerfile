FROM node:lts-alpine3.22

RUN apk add --no-cache git curl bash libgcc libstdc++ ripgrep jq

RUN SNIPPET="export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \
  && mkdir /commandhistory \
  && touch /commandhistory/.bash_history \
  && chown -R node /commandhistory \
  && echo "$SNIPPET" >> "/home/node/.bashrc"

USER node
WORKDIR /home/node

ENV USE_BUILTIN_RIPGREP=0
RUN curl -fsSL https://claude.ai/install.sh | bash && \
  mkdir -p /home/node/claude-config
ENV CLAUDE_CONFIG_DIR=/home/node/claude-config
ENV PATH="$HOME/.local/bin:$PATH"

WORKDIR /workspaces/osm-hiking

EXPOSE 8000
