import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Translation resources
const resources = {
  en: {
    translation: {
      // Navigation and Layout
      preferences: 'Preferences',
      settings: 'Settings',
      backToSettings: 'Back to Settings',

      // Preferences Page
      preferencesTitle: 'Preferences',
      preferencesDescription: 'Manage your general application preferences and appearance settings.',

      // Appearance Section
      appearance: 'Appearance',
      appearanceDescription: 'Customize how the application looks and feels.',
      theme: 'Theme',
      themeDescription: 'Choose between light, dark, or system theme preference.',

      // Language Section
      language: 'Language',
      languageDescription: 'Select your preferred language for the interface.',

      // Language Options
      english: 'English',
      portuguese: 'Portuguese',

      // Theme Options
      light: 'Light',
      dark: 'Dark',
      system: 'System',

      // Common UI Elements
      save: 'Save',
      cancel: 'Cancel',
      close: 'Close',
      open: 'Open',
      edit: 'Edit',
      delete: 'Delete',
      create: 'Create',
      update: 'Update',
      loading: 'Loading...',
      error: 'Error',
      success: 'Success',
      warning: 'Warning',
      info: 'Information',

      // Shakespeare Main Page
      buildNostrApps: 'Build Nostr apps with AI',
      whatToBuild: 'What would you like to build?',
      createProject: 'Create Project',
      generating: 'Generating...',
      creating: 'Creating...',
      chooseModel: 'Choose a model...',
      selectModelFirst: "Please select a model below, then describe what you'd like to build...",
      examplePrompt: "e.g., Create a farming equipment marketplace for local farmers to buy and sell tractors, tools, and supplies...",

      // Settings Page
      settingsTitle: 'Settings',
      settingsDescription: 'Manage your application settings and preferences.',
      aiSettings: 'AI Settings',
      aiSettingsDescription: 'Configure AI providers and API keys',
      gitSettings: 'Git Settings',
      gitSettingsDescription: 'Configure Git credentials for HTTP authentication',
      nostrSettings: 'Nostr Settings',
      nostrSettingsDescription: 'Configure relay connections and Nostr preferences',
      dataSettings: 'Data',
      dataSettingsDescription: 'Export files and manage local data',
    }
  },
  pt: {
    translation: {
      // Navigation and Layout
      preferences: 'Preferências',
      settings: 'Configurações',
      backToSettings: 'Voltar às Configurações',

      // Preferences Page
      preferencesTitle: 'Preferências',
      preferencesDescription: 'Gerencie suas preferências gerais da aplicação e configurações de aparência.',

      // Appearance Section
      appearance: 'Aparência',
      appearanceDescription: 'Personalize como a aplicação se parece e funciona.',
      theme: 'Tema',
      themeDescription: 'Escolha entre preferência de tema claro, escuro ou do sistema.',

      // Language Section
      language: 'Idioma',
      languageDescription: 'Selecione seu idioma preferido para a interface.',

      // Language Options
      english: 'Inglês',
      portuguese: 'Português',

      // Theme Options
      light: 'Claro',
      dark: 'Escuro',
      system: 'Sistema',

      // Common UI Elements
      save: 'Salvar',
      cancel: 'Cancelar',
      close: 'Fechar',
      open: 'Abrir',
      edit: 'Editar',
      delete: 'Excluir',
      create: 'Criar',
      update: 'Atualizar',
      loading: 'Carregando...',
      error: 'Erro',
      success: 'Sucesso',
      warning: 'Aviso',
      info: 'Informação',

      // Shakespeare Main Page
      buildNostrApps: 'Construa aplicativos Nostr com IA',
      whatToBuild: 'O que você gostaria de construir?',
      createProject: 'Criar Projeto',
      generating: 'Gerando...',
      creating: 'Criando...',
      chooseModel: 'Escolha um modelo...',
      selectModelFirst: "Por favor, selecione um modelo abaixo e depois descreva o que gostaria de construir...",
      examplePrompt: "ex., Criar um marketplace de equipamentos agrícolas para fazendeiros locais comprarem e venderem tratores, ferramentas e suprimentos...",

      // Settings Page
      settingsTitle: 'Configurações',
      settingsDescription: 'Gerencie as configurações e preferências da aplicação.',
      aiSettings: 'Configurações de IA',
      aiSettingsDescription: 'Configure provedores de IA e chaves de API',
      gitSettings: 'Configurações do Git',
      gitSettingsDescription: 'Configure credenciais do Git para autenticação HTTP',
      nostrSettings: 'Configurações do Nostr',
      nostrSettingsDescription: 'Configure conexões de relay e preferências do Nostr',
      dataSettings: 'Dados',
      dataSettingsDescription: 'Exporte arquivos e gerencie dados locais',
    }
  }
};

// Initialize i18next
i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en', // Default language
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    react: {
      useSuspense: false, // Disable suspense for better compatibility
    }
  });

export default i18n;