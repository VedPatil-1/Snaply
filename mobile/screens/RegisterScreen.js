import React, { useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import { api, setAuthToken } from "../services/api";

export default function RegisterScreen({ navigation, onRegistered }) {
    const [name, setName] = useState("");
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleRegister = async () => {
        setError("");

        if (!name.trim()) {
            setError("Please enter your name.");
            return;
        }

        if (!username.trim()) {
            setError("Please enter a username.");
            return;
        }

        if (!email.trim()) {
            setError("Please enter your email.");
            return;
        }

        if (!password) {
            setError("Please enter a password.");
            return;
        }

        if (password.length < 6) {
            setError("Password must be at least 6 characters.");
            return;
        }

        try {
            setLoading(true);

            const response = await api.post("/auth/register", {
                name: name.trim(),
                username: username.trim(),
                email: email.trim(),
                password,
            });

            await setAuthToken(response.token);

            if (onRegistered) {
                onRegistered(response.user);
            }
        } catch (err) {
            console.error("Registration error:", err);

            setError(
                err?.message ||
                "Registration failed. Please try again."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={
                    Platform.OS === "ios"
                        ? "padding"
                        : undefined
                }
            >
                <ScrollView
                    contentContainerStyle={styles.container}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.header}>
                        <Text style={styles.logo}>Snaply</Text>

                        <Text style={styles.title}>
                            Create your account
                        </Text>

                        <Text style={styles.subtitle}>
                            Join Snaply and start sharing.
                        </Text>
                    </View>

                    <View style={styles.form}>
                        <TextInput
                            style={styles.input}
                            placeholder="Full name"
                            placeholderTextColor="#999"
                            value={name}
                            onChangeText={setName}
                            autoCapitalize="words"
                        />

                        <TextInput
                            style={styles.input}
                            placeholder="Username"
                            placeholderTextColor="#999"
                            value={username}
                            onChangeText={setUsername}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />

                        <TextInput
                            style={styles.input}
                            placeholder="Email"
                            placeholderTextColor="#999"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                        />

                        <TextInput
                            style={styles.input}
                            placeholder="Password"
                            placeholderTextColor="#999"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            autoCapitalize="none"
                        />

                        {error ? (
                            <Text style={styles.error}>
                                {error}
                            </Text>
                        ) : null}

                        <TouchableOpacity
                            style={[
                                styles.registerButton,
                                loading && styles.disabledButton,
                            ]}
                            onPress={handleRegister}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.registerButtonText}>
                                    Create Account
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    <View style={styles.loginRow}>
                        <Text style={styles.loginText}>
                            Already have an account?
                        </Text>

                        <TouchableOpacity
                            onPress={() =>
                                navigation.navigate("Login")
                            }
                        >
                            <Text style={styles.loginLink}>
                                Log in
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: "#fff",
    },

    keyboardView: {
        flex: 1,
    },

    container: {
        flexGrow: 1,
        justifyContent: "center",
        paddingHorizontal: 28,
        paddingVertical: 40,
    },

    header: {
        alignItems: "center",
        marginBottom: 36,
    },

    logo: {
        fontSize: 38,
        fontWeight: "800",
        color: "#000",
        marginBottom: 20,
    },

    title: {
        fontSize: 26,
        fontWeight: "700",
        color: "#111",
        textAlign: "center",
    },

    subtitle: {
        marginTop: 8,
        fontSize: 15,
        color: "#777",
        textAlign: "center",
    },

    form: {
        width: "100%",
    },

    input: {
        height: 52,
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 16,
        color: "#111",
        marginBottom: 14,
        backgroundColor: "#fafafa",
    },

    error: {
        color: "#e53935",
        fontSize: 14,
        marginBottom: 14,
    },

    registerButton: {
        height: 52,
        borderRadius: 12,
        backgroundColor: "#000",
        alignItems: "center",
        justifyContent: "center",
        marginTop: 4,
    },

    disabledButton: {
        opacity: 0.6,
    },

    registerButtonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
    },

    loginRow: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        marginTop: 28,
    },

    loginText: {
        color: "#777",
        fontSize: 14,
    },

    loginLink: {
        color: "#000",
        fontSize: 14,
        fontWeight: "700",
        marginLeft: 5,
    },
});