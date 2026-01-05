Perfect — this is already a **strong project**, we’ll now turn the README into a **portfolio-grade README** that:

* Instantly shows **what problem you solved**
* Highlights **engineering decisions**
* Sounds **confident & professional**
* Appeals to **recruiters + senior devs**

Below is an **optimized README**.
You can replace your existing one with this.

---

```markdown
# 🔍 Multimodal Wikipedia Search Engine  
### Text & Image Search using CLIP, FAISS, and Dash

A **production-style multimodal search engine** that allows users to query Wikipedia content using **text or images**.  
The system embeds both modalities into a shared vector space using **OpenAI CLIP** and performs fast similarity search with **FAISS**, exposed through a clean **Dash web interface**.

> This project demonstrates **end-to-end ML systems engineering**: data crawling, preprocessing, embedding, indexing, and interactive search.

---

## 🚀 Why This Project Matters

Traditional search engines treat **text and images separately**.  
This project shows how modern **multimodal models** can unify them — enabling:

- 🖼️ Image → Text search  
- 🔤 Text → Image search  
- 🔗 Cross-modal retrieval at scale  

It mirrors real-world systems used in **Google Images, Pinterest, and multimodal RAG pipelines**.

---

## ✨ Key Features

- 🔎 **Text-to-Text & Text-to-Image Search**
- 🖼️ **Image-to-Image & Image-to-Text Search**
- 🌐 **Wikipedia Web Crawler (BFS)**
- 🤖 **CLIP embeddings (shared embedding space)**
- ⚡ **FAISS vector similarity search**
- 🎨 **Minimal Google-style UI (Dash)**

---

## 🧠 System Architecture

```

Wikipedia Pages
↓
[Crawler]
↓
Text + Images + Metadata
↓
[CLIP Embedding]
↓
512-D Vectors
↓
[FAISS Index]
↓
[Dash Search UI]

```

---

## 🏗️ Project Structure

```

Final/
├── app.py                 # Dash web application (search UI)
├── crawler.py             # BFS Wikipedia crawler
├── embed.py               # CLIP embedding + FAISS indexing
├── wikipedia_scrape/
│   ├── images/            # Downloaded images
│   └── meta/              # Page metadata (JSON)
├── indices1/
│   ├── text.index         # FAISS text index
│   ├── image.index        # FAISS image index
│   ├── text_meta.json
│   └── image_meta.json

````

---

## ⚙️ Tech Stack

| Layer | Technology |
|-----|-----------|
| Crawling | `requests`, `BeautifulSoup`, BFS |
| Embeddings | `openai/clip-vit-base-patch32` |
| Vector Search | `FAISS (IndexFlatIP)` |
| Backend | Python |
| UI | Dash |
| ML Framework | PyTorch |
| Image Processing | Pillow |

---

## 🔍 How It Works

### 1️⃣ Crawling
- Breadth-first crawl of Wikipedia pages
- Extracts:
  - Clean text paragraphs
  - High-resolution images + captions
- Stores structured metadata (JSON)

### 2️⃣ Embedding
- CLIP embeds **text and images into the same 512-D space**
- Vectors are L2-normalized
- Enables **cross-modal similarity search**

### 3️⃣ Indexing
- FAISS `IndexFlatIP` for fast cosine similarity
- Separate indices for text and images
- Metadata stored alongside vectors

### 4️⃣ Search
- User submits **text or image**
- Query embedded via CLIP
- FAISS returns top-K matches
- Results rendered in UI

---

## 🖼️ Supported Search Modes

| Input | Output |
|-----|-------|
| Text | Relevant text + images |
| Image | Similar images + related text |

---

## 📦 Installation

```bash
pip install dash pillow numpy faiss-cpu torch transformers tqdm requests beautifulsoup4
````

> Use `faiss-gpu` if CUDA is available.

---

## 🚀 Running the Project

### Crawl Wikipedia

```bash
python crawler.py
```

### Create Embeddings & Indices

```bash
python embed.py
```

### Launch Search UI

```bash
python app.py
```

Open:
👉 `http://127.0.0.1:8050`

---

## 📊 Model & Search Details

* **Model**: CLIP ViT-B/32
* **Embedding Dimension**: 512
* **Similarity Metric**: Cosine (via Inner Product)
* **Top-K Retrieval**: 5 (configurable)

---

## ⚠️ Limitations

* Wikipedia crawl depth is capped
* No semantic re-ranking (yet)
* Dash is single-user
* No text chunking (future improvement)

---

## 🔮 Future Improvements

* 🔁 Cross-encoder re-ranking
* 🔍 Hybrid search (BM25 + embeddings)
* 🧩 Text chunking
* 🚀 FastAPI backend
* 🎨 React / Tailwind frontend
* ☁️ Docker + cloud deployment

---

## 👤 Author

**Rojan Adhikari**
🔗 GitHub: [https://github.com/Rojan7](https://github.com/Rojan7)

> Built as a hands-on exploration of **multimodal retrieval systems**, vector databases, and real-world ML pipelines.

