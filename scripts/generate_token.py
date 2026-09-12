import os
import json
from google_auth_oauthlib.flow import InstalledAppFlow

# Le droit d'accès dont on a besoin pour modifier les labels Gmail
SCOPES = ['https://www.googleapis.com/auth/gmail.modify']

def main():
    print("=== Génération du Token Gmail ===")
    
    # On charge le fichier credentials.json
    flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
    
    print("\nDémarrage du serveur d'authentification...")
    print("👉 Codespaces devrait vous afficher une notification en bas à droite : 'Your application running on port 8080 is available.'")
    print("👉 Cliquez sur 'Open in Browser' (Ouvrir dans le navigateur).")
    
    # On utilise un serveur local fixe sur le port 8080 (sans forcer l'ouverture du navigateur côté serveur)
    creds = flow.run_local_server(port=8080, open_browser=False)

    # Sauvegarde des identifiants dans un dictionnaire propre
    token_data = {
        'token': creds.token,
        'refresh_token': creds.refresh_token,
        'token_uri': creds.token_uri,
        'client_id': creds.client_id,
        'client_secret': creds.client_secret,
        'scopes': creds.scopes
    }
    
    # Écriture du fichier token.json
    with open('token.json', 'w') as token:
        json.dump(token_data, token)
    
    print("\n✅ Succès ! Le fichier 'token.json' a été généré.")
    print("Ouvrez-le et copiez TOUT son contenu.")

if __name__ == '__main__':
    main()
