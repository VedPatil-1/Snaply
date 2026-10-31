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
import Ionicons from 'react-native-vector-icons/Ionicons';
import { colors, radius, spacing, typography } from '../theme';

export default function RegisterScreen({ navigation, onRegistered }) {
    const [name, setName] = useState("");
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [passwordVisible, setPasswordVisible] = useState(false);

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
                err?.kind === "network" ? err.message :
                err?.kind === "server" ? "The Snaply server is unavailable. Please try again shortly." :
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
                            : "height"
                }
            >
                <ScrollView
                    contentContainerStyle={styles.container}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.header}>
                        <View style={styles.brandMark}><Ionicons name="sparkles" size={22} color="#fff" /></View>
                        <Text style={styles.logo}>Snaply</Text>

                        <Text style={styles.title}>
                            Create your account
                        </Text>

                        <Text style={styles.subtitle}>
                            Join Snaply and start sharing.
                        </Text>
                    </View>

                    <View style={styles.form}>
                        <View style={styles.inputWrap}>
                        <Ionicons name="person-outline" size={19} color={colors.textMuted} />
                        <TextInput
                            style={styles.input}
                            placeholder="Full name"
                            placeholderTextColor="#999"
                            value={name}
                            onChangeText={setName}
                            autoCapitalize="words"
                        />
                        </View>

                        <View style={styles.inputWrap}>
                        <Ionicons name="at-outline" size={19} color={colors.textMuted} />
                        <TextInput
                            style={styles.input}
                            placeholder="Username"
                            placeholderTextColor="#999"
                            value={username}
                            onChangeText={setUsername}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        </View>

                        <View style={styles.inputWrap}>
                        <Ionicons name="mail-outline" size={19} color={colors.textMuted} />
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
                        </View>

                        <View style={styles.inputWrap}>
                        <Ionicons name="lock-closed-outline" size={19} color={colors.textMuted} />
                        <TextInput
                            style={styles.input}
                            placeholder="Password"
                            placeholderTextColor="#999"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!passwordVisible}
                            autoCapitalize="none"
                        />
                        <TouchableOpacity onPress={() => setPasswordVisible((value) => !value)}>
                            <Ionicons name={passwordVisible ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                        </View>

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
        backgroundColor: colors.bg,
    },

    keyboardView: {
        flex: 1,
    },

    container: {
        flexGrow: 1,
        justifyContent: "center",
        paddingHorizontal: spacing.lg,
        paddingVertical: 40,
    },

    header: {
        alignItems: "center",
        marginBottom: spacing.xl,
    },

    brandMark: {
        width: 52,
        height: 52,
        borderRadius: radius.lg,
        backgroundColor: colors.accent,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: spacing.md,
    },

    logo: {
        ...typography.display,
        color: colors.text,
        marginBottom: spacing.sm,
    },

    title: {
        ...typography.title,
        color: colors.text,
        textAlign: "center",
    },

    subtitle: {
        marginTop: 8,
        fontSize: 15,
        color: colors.textSecondary,
        textAlign: "center",
    },

    form: {
        width: "100%",
    },

    inputWrap: {
        minHeight: 54,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.borderStrong,
        borderRadius: radius.md,
        paddingHorizontal: 16,
        marginBottom: spacing.md,
        backgroundColor: colors.surface,
    },
    input: {
        flex: 1,
        paddingHorizontal: spacing.sm,
        fontSize: 16,
        color: colors.text,
    },

    error: {
        color: "#dc2626",
        fontSize: 14,
        marginBottom: 14,
    },

    registerButton: {
        height: 52,
        borderRadius: radius.md,
        backgroundColor: colors.accent,
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
        color: colors.accentDeep,
        fontSize: 14,
        fontWeight: "700",
        marginLeft: 5,
    },
});