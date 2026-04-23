import pandas as pd

# Load datasets
orders = pd.read_csv("data/olist_orders_dataset.csv")
customers = pd.read_csv("data/olist_customers_dataset.csv")
order_items = pd.read_csv("data/olist_order_items_dataset.csv")
payments = pd.read_csv("data/olist_order_payments_dataset.csv")
reviews = pd.read_csv("data/olist_order_reviews_dataset.csv")

datasets = {
    "orders": orders,
    "customers": customers,
    "order_items": order_items,
    "payments": payments,
    "reviews": reviews
}

# Explore each dataset
for name, df in datasets.items():
    print(f"\n===== {name.upper()} =====")
    print("Shape:", df.shape)
    print("\nColumns:")
    print(df.columns)
    print("\nFirst 5 rows:")
    print(df.head())
    print("\nMissing values:")
    print(df.isnull().sum())