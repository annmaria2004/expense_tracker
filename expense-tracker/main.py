from fastapi import FastAPI, Request, Form
from fastapi.templating import Jinja2Templates
from fastapi.responses import RedirectResponse
from bson import ObjectId
from datetime import datetime

from database import expenses

app = FastAPI()

templates = Jinja2Templates(directory="templates")


@app.get("/")
def home(request: Request):

    all_expenses = list(expenses.find())

    current_month = datetime.now().strftime("%Y-%m")

    total = 0
    summary = {}

    for e in all_expenses:

        if e["date"].startswith(current_month):

            total += float(e["amount"])

            category = e["category"]

            summary[category] = (
                summary.get(category, 0)
                + float(e["amount"])
            )

    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "expenses": all_expenses,
            "total": total,
            "summary": summary
        }
    )


@app.post("/add")
def add_expense(
    title: str = Form(...),
    amount: float = Form(...),
    category: str = Form(...),
    date: str = Form(...),
    note: str = Form("")
):

    expenses.insert_one(
        {
            "title": title,
            "amount": amount,
            "category": category,
            "date": date,
            "note": note
        }
    )

    return RedirectResponse(
        url="/",
        status_code=303
    )


@app.get("/delete/{id}")
def delete_expense(id: str):

    expenses.delete_one(
        {"_id": ObjectId(id)}
    )

    return RedirectResponse(
        url="/",
        status_code=303
    )