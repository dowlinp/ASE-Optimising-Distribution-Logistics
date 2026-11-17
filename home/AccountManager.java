
package home;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

public class AccountManager {

    public record Account(String username, String email, String passwordHash) {
    }

    private static Connection connect() throws SQLException {
        return DriverManager.getConnection(
                System.getenv("DB_URL"),
                System.getenv("DB_USER"),
                System.getenv("DB_PASSWORD"));
    }

    public static boolean createAccount(String username, String email,
            String passwordHash, String address, String eircode, String phoneNumber) {

        String sql = """
                INSERT INTO ACCOUNTS
                (USERNAME, EMAIL, PASSWORD_HASH, ADDRESS, EIRCODE, PHONE_NUMBER)
                VALUES (?, ?, ?, ?, ?, ?)
                """;

        try (Connection conn = connect();
                PreparedStatement stmt = conn.prepareStatement(sql)) {

            stmt.setString(1, username);
            stmt.setString(2, email);
            stmt.setString(3, passwordHash);
            stmt.setString(4, address);
            stmt.setString(5, eircode);
            stmt.setString(6, phoneNumber);

            stmt.executeUpdate();
            return true;

        } catch (SQLException e) {
            e.printStackTrace();
            return false;
        }
    }

    public static Account findAccount(String login) {
        String sql = """
                SELECT USERNAME, EMAIL, PASSWORD_HASH
                FROM ACCOUNTS
                WHERE LOWER(USERNAME) = LOWER(?)
                   OR LOWER(EMAIL) = LOWER(?)
                """;

        try (Connection conn = connect();
                PreparedStatement stmt = conn.prepareStatement(sql)) {

            stmt.setString(1, login);
            stmt.setString(2, login);

            try (ResultSet result = stmt.executeQuery()) {
                if (result.next()) {
                    return new Account(
                            result.getString("USERNAME"),
                            result.getString("EMAIL"),
                            result.getString("PASSWORD_HASH"));
                }
            }

        } catch (SQLException e) {
            e.printStackTrace();
        }

        return null;
    }

    public static boolean accountExists(String username) {
        return exists("SELECT COUNT(*) FROM ACCOUNTS WHERE USERNAME = ?", username);
    }

    public static boolean emailExists(String email) {
        return exists("SELECT COUNT(*) FROM ACCOUNTS WHERE EMAIL = ?", email);
    }

    private static boolean exists(String sql, String value) {
        try (Connection conn = connect();
                PreparedStatement stmt = conn.prepareStatement(sql)) {

            stmt.setString(1, value);

            try (ResultSet result = stmt.executeQuery()) {
                return result.next() && result.getInt(1) > 0;
            }

        } catch (SQLException e) {
            e.printStackTrace();
            return false;
        }
    }
}
