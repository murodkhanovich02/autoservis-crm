from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Autoservis CRM"
    database_url: str = "sqlite:///./autoservis.db"
    secret_key: str = "dev-secret-change-me"
    access_token_expire_minutes: int = 60 * 12
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    timezone: str = "Asia/Tashkent"

    # SMS: "console" faqat logga yozadi, "eskiz" — notify.eskiz.uz orqali yuboradi
    sms_provider: str = "console"
    eskiz_email: str = ""
    eskiz_password: str = ""
    eskiz_from: str = "4546"
    eskiz_base_url: str = "https://notify.eskiz.uz/api"

    # Eslatma SMS'larini avtomatik yuborish (masalan, moy almashtirish vaqti)
    reminders_autorun: bool = True
    reminders_interval_minutes: int = 60
    reminders_hour_from: int = 9
    reminders_hour_to: int = 20


settings = Settings()
