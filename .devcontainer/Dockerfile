FROM mcr.microsoft.com/playwright:v1.56.0-noble

RUN apt-get update && apt-get install -y git curl ripgrep jq

RUN SNIPPET="export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \
  && mkdir /commandhistory \
  && touch /commandhistory/.bash_history \
  && chown -R ubuntu /commandhistory \
  && echo "$SNIPPET" >> "/home/ubuntu/.bashrc"

USER ubuntu
WORKDIR /home/ubuntu

RUN curl -fsSL https://claude.ai/install.sh | bash && \
  mkdir -p /home/ubuntu/claude-config
ENV CLAUDE_CONFIG_DIR=/home/ubuntu/claude-config
ENV PATH="/home/ubuntu/.local/bin:$PATH"

WORKDIR /workspaces/osm-hiking
