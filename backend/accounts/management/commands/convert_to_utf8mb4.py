from django.core.management.base import BaseCommand
from django.db import connection

class Command(BaseCommand):
    help = 'Convert all tables to utf8mb4 charset and collation'

    def handle(self, *args, **options):
        with connection.cursor() as cursor:
            # Get database name
            cursor.execute("SELECT DATABASE()")
            db_name = cursor.fetchone()[0]

            self.stdout.write(f"Converting database {db_name} to utf8mb4...")
            
            # Convert database
            cursor.execute(f"ALTER DATABASE `{db_name}` CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci")

            # Get all tables
            cursor.execute("SHOW TABLES")
            tables = [row[0] for row in cursor.fetchall()]

            for table in tables:
                self.stdout.write(f"Converting table {table}...")
                cursor.execute(f"ALTER TABLE `{table}` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")

            self.stdout.write(self.style.SUCCESS('Successfully converted database and all tables to utf8mb4'))
