# durakonline

git clone https://github.com/neckface/durakonline.git

cd durakonline
cd durak-backend

npm install

# in .env
DATABASE_URL="postgresql://postgres:ВАШ_ПАРОЛЬ@db.ofaugqegmlxzctupists.supabase.co:6543/postgres?pgbouncer=true"
npx dotenv -e .env -- npx prisma generate
npx tsx server.ts


# frontend

cd durakonline/durak_app
flutter pub get
flutter run -d websocket
