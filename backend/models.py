# backend/models.py
from pydantic import BaseModel
from typing import List, Optional


class TextResult(BaseModel):
    page_id: int
    title: str
    url: str
    section: Optional[str]
    text: str
    score: float


class ImageResult(BaseModel):
    page_id: int
    title: str
    url: str
    section: Optional[str]
    filename: str
    caption: Optional[str]
    score: float


class TextSearchResponse(BaseModel):
    results: List[TextResult]


class ImageSearchResponse(BaseModel):
    filename: str
    results: List[ImageResult]
