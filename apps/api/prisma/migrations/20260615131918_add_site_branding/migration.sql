-- AlterTable
ALTER TABLE "sites" ADD COLUMN     "accentColor" TEXT NOT NULL DEFAULT '#f5f5f5',
ADD COLUMN     "loginMethods" TEXT NOT NULL DEFAULT 'email,clickthrough',
ADD COLUMN     "primaryColor" TEXT NOT NULL DEFAULT '#0055ff',
ADD COLUMN     "welcomeText" TEXT NOT NULL DEFAULT 'Connettiti al WiFi gratuito.',
ADD COLUMN     "welcomeTitle" TEXT NOT NULL DEFAULT 'Benvenuto!';
