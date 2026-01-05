

```markdown
# 🔍 Multimodal Wikipedia Search Engine

A multimodal search engine that allows **text and image based search** over Wikipedia content using **CLIP embeddings** and **FAISS vector search**, with a simple **Dash web interface**.

---

## 🚀 Overview

- Crawl Wikipedia pages (text + images)
- Embed both modalities into a **shared vector space (CLIP)**
- Perform fast similarity search using **FAISS**
- Search using **text or image queries**
- Display ranked text and image results

---

## 🧠 Tech Stack

- **Model:** openai/clip-vit-base-patch32  
- **Vector DB:** FAISS (IndexFlatIP)  
- **Backend:** Python  
- **UI:** Dash  
- **ML:** PyTorch  
- **Scraping:** BeautifulSoup, Requests  

---

## 📁 Structure

```

app.py        → Dash search UI
crawler.py   → Wikipedia BFS crawler
embed.py     → CLIP embedding + FAISS indexing
indices1/    → FAISS indices & metadata

````

---

## 🔍 Search Modes

- **Text → Text + Images**
- **Image → Images + Text**

---

## ▶️ Run

```bash
pip install dash pillow numpy faiss-cpu torch transformers tqdm requests beautifulsoup4
python crawler.py
python embed.py
python app.py
````

Open: `http://127.0.0.1:8050`

---

## 🎯 Key Concepts

* Multimodal retrieval
* Shared embedding space
* Vector similarity search
* End-to-end ML pipeline

---

## 👤 Author

**Rojan Adhikari**
[https://github.com/Rojan7](https://github.com/Rojan7)

