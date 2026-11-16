import com.sun.net.httpserver.HttpServer;

import java.net.InetSocketAddress;
import java.nio.file.Files;
import java.nio.file.Path;

public class App {
    public static void main(String[] args) throws Exception {
        String host = System.getenv().getOrDefault("HOST", "127.0.0.1");
        HttpServer server = HttpServer.create(new InetSocketAddress(host, 5000), 0);

        server.createContext("/", exchange -> {
            byte[] body = Files.readAllBytes(Path.of("home/home.html"));
            exchange.getResponseHeaders().set("Content-Type", "text/html; charset=utf-8");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });

        server.createContext("/Account", exchange -> {
            byte[] body = Files.readAllBytes(Path.of("home/account.html"));
            exchange.getResponseHeaders().set("Content-Type", "text/html; charset=utf-8");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });

        server.createContext("/User", exchange -> {
            byte[] body = Files.readAllBytes(Path.of("frontend/frontend.html"));
            exchange.getResponseHeaders().set("Content-Type", "text/html; charset=utf-8");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });

        server.createContext("/Warehouse", exchange -> {
            byte[] body = Files.readAllBytes(Path.of("warehouse/warehouse.html"));
            exchange.getResponseHeaders().set("Content-Type", "text/html; charset=utf-8");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });

        server.createContext("/warehouse-assets/", exchange -> {
            String filename = exchange.getRequestURI().getPath().substring("/warehouse-assets/".length());
            if (!filename.equals("demo-data.js") && !filename.equals("warehouse.js")) {
                exchange.sendResponseHeaders(404, -1);
                exchange.close();
                return;
            }
            byte[] body = Files.readAllBytes(Path.of("warehouse", filename));
            exchange.getResponseHeaders().set("Content-Type", "text/javascript; charset=utf-8");
            exchange.sendResponseHeaders(200, body.length);
            try (var output = exchange.getResponseBody()) {
                output.write(body);
            }
        });

        server.createContext("/Delivery", exchange -> {
            byte[] body = Files.readAllBytes(Path.of("delivery/delivery.html"));
            exchange.getResponseHeaders().set("Content-Type", "text/html; charset=utf-8");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });

        server.createContext("/css/", exchange -> {
            String filename = exchange.getRequestURI().getPath()
                    .replace("/css/", "");

            if (!filename.matches("[a-zA-Z0-9_-]+\\.css")) {
                exchange.sendResponseHeaders(400, -1);
                exchange.close();
                return;
            }

            Path file = Path.of("css", filename);

            if (!Files.isRegularFile(file)) {
                exchange.sendResponseHeaders(404, -1);
                exchange.close();
                return;
            }

            byte[] body = Files.readAllBytes(file);

            exchange.getResponseHeaders().set("Content-Type", "text/css; charset=utf-8");
            exchange.sendResponseHeaders(200, body.length);

            try (var output = exchange.getResponseBody()) {
                output.write(body);
            }
        });
        
        server.createContext("/videos/", exchange -> {
            String filename = exchange.getRequestURI().getPath().replace("/videos/", "");

            if (!filename.matches("[a-zA-Z0-9_-]+\\.png")) {
                exchange.sendResponseHeaders(400, -1);
                exchange.close();
                return;
            }

            Path imagePath = Path.of("videos", filename);

            if (!Files.exists(imagePath)) {
                exchange.sendResponseHeaders(404, -1);
                exchange.close();
                return;
            }

            byte[] image = Files.readAllBytes(imagePath);

            exchange.getResponseHeaders().set("Content-Type", "image/png");
            exchange.sendResponseHeaders(200, image.length);

            try (var output = exchange.getResponseBody()) {
                output.write(image);
            }
        });

        server.createContext("/routes/", exchange -> {

            String filename = exchange.getRequestURI().getPath().replace("/routes/", "");

            if (!filename.matches("[a-zA-Z0-9_-]+\\.geojson")) {
                exchange.sendResponseHeaders(400, -1);
                exchange.close();
                return;
            }

            Path routesFolder = Path.of("delivery/routes").toAbsolutePath().normalize();

            Path file = routesFolder.resolve(filename).normalize();

            if (!file.startsWith(routesFolder) || !Files.exists(file)) {
                exchange.sendResponseHeaders(404, -1);
                exchange.close();
                return;
            }

            byte[] body = Files.readAllBytes(file);

            exchange.getResponseHeaders().set("Content-Type", "application/geo+json");

            exchange.sendResponseHeaders(200, body.length);

            try (var output = exchange.getResponseBody()) {
                output.write(body);
            }
        });

        server.start();
        System.out.println("Running on http://" + host + ":5000");
    }
}
