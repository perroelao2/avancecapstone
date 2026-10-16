#!/bin/bash
export LD_LIBRARY_PATH="$HOME/.local/mariadb_root/usr/lib:$LD_LIBRARY_PATH"
export PATH="$HOME/.local/mariadb_root/usr/bin:$PATH"

if ! pgrep -f "mariadbd.*mariadb_data" > /dev/null; then
  echo "Iniciando servidor MySQL/MariaDB local en puerto 3306..."
  nohup "$HOME/.local/mariadb_root/usr/bin/mariadbd" \
    --basedir="$HOME/.local/mariadb_root/usr" \
    --datadir="$HOME/.local/mariadb_data" \
    --socket="$HOME/.local/mariadb_data/mysql.sock" \
    --port=3306 \
    --pid-file="$HOME/.local/mariadb_data/mysql.pid" \
    > "$HOME/.local/mariadb_data/mariadb.log" 2>&1 &
  sleep 2
else
  echo "Servidor MySQL/MariaDB ya está en ejecución (puerto 3306)."
fi
