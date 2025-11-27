## To-dos

- Responsive and resizing UI.
- Testing.
- Updater: restart upong completion. Avoid: node.js, git, npm, toolchain,
  signing and quarantine.
- Allow different score formulas.
- Support insurance companies and financial institutions.
- Performance and memory optimizations accross the application.
- Keyboard navigation.
- Charts and sankey visualization.
- Note-taking within ticker view.
- RAG chat within ticker view (JSON data).
- RAG chat with doc / parsed text.
- Parse CSR URLs.
- Mark/unmark tickers currently on portfolio -> filter/search through dialog.
- Web-search for portfolio tickers latest news.
- Monte Carlo simulation with >=5 periods.
- Support ETFs, Index Funds. If ticker starts with 'FUND.{ISIN}' -> fetch KID ->
  return basic info.
- Add LLM options (Anthropic, Google, Cloudflare, AWS, Groq, Deepseek, Qwen...)
- Local LLMs options: embed fine-tuned small LLM, llama-cpp, Ollama...
- Local NER fine-tuning:
  - [Chunks classifier](./ner/ner-roadmap-1.md): extracts targeted chunks within
    report (balance, income, cash flow).
  - [Data extractor](./ner/ner-roadmap-2.md): extract financial data from each
    section from chunk classifier.
- Integrate Alpha Vantage API or ticker price scraper for live-pricing.
