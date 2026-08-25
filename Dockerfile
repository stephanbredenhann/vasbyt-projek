# Three stages, because the .NET SDK image has no Node and `dotnet publish` shells out to npm.
# Building the frontend separately also means a backend-only change reuses the cached npm layers.

# ---- 1. Angular ------------------------------------------------------------
FROM node:22-alpine AS frontend
WORKDIR /build/src/Vasbyt.Frontend

# package.json alone first: this layer only rebuilds when dependencies actually change,
# not on every source edit.
COPY src/Vasbyt.Frontend/package.json src/Vasbyt.Frontend/package-lock.json ./
RUN npm ci

COPY src/Vasbyt.Frontend/ ./
# angular.json writes to ../Vasbyt.API/wwwroot, so this lands in /build/src/Vasbyt.API/wwwroot
RUN npm run build

# ---- 2. .NET ---------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS backend
WORKDIR /build

COPY src/Vasbyt.API/Vasbyt.API.csproj src/Vasbyt.API/
RUN dotnet restore src/Vasbyt.API/Vasbyt.API.csproj

COPY src/Vasbyt.API/ src/Vasbyt.API/
# SkipFrontend because stage 1 already did it — this is the flag's whole reason for existing.
RUN dotnet publish src/Vasbyt.API/Vasbyt.API.csproj \
    -c Release -o /app --no-restore -p:SkipFrontend=true

# ---- 3. Runtime ------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

COPY --from=backend /app ./
COPY --from=frontend /build/src/Vasbyt.API/wwwroot ./wwwroot

# APP_UID is defined by the base image (1654). Never run this as root.
USER $APP_UID

# .NET 8 containers default to 8080. Caddy reaches this by service name on the shared
# Docker network; the port is never published to the host.
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "Vasbyt.API.dll"]
