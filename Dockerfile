# Usa una imagen base oficial de Node.js
FROM node:14

# Establece el directorio de trabajo en /app dentro del contenedor
WORKDIR /app

# Copia los archivos de configuración de npm al directorio de trabajo
COPY package*.json ./

# Instala las dependencias de npm
RUN npm install

# Copia el resto de los archivos de tu proyecto al directorio de trabajo
COPY . .

# Construye la aplicación Next.js
RUN npm run build

# Expone el puerto en el que tu aplicación va a correr (por defecto, 3000)
EXPOSE 3000

# Comando por defecto para ejecutar tu aplicación
CMD ["npm", "start"]
