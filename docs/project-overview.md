# HomePilot - Visión General del Proyecto

## ¿Qué es HomePilot?
HomePilot es una plataforma de domótica de próxima generación diseñada principalmente para clientes de hogares inteligentes premium. Su objetivo es competir con sistemas de alta gama instalados por profesionales, como Control4, pero se distingue por una arquitectura moderna y modular, y una base sólida para la futura toma de decisiones por Inteligencia Artificial (IA).

## Visión
Entregar un ecosistema de hogar robusto, completamente personalizable e inteligente que opere de manera fluida en el Edge (borde/local), mientras orquesta automatizaciones complejas sin la fragilidad de los motores de domótica heredados (legacy).

## Principios Centrales
1. **Modularidad**: La lógica de dominio, las integraciones de dispositivos y las interfaces de usuario (UI) están estrictamente desacopladas. Deberías poder cambiar una integración sin alterar el motor central.
2. **Edge-First (Prioridad Local)**: El sistema debe ser capaz de cumplir con sus funciones principales de forma local. La dependencia de la nube (Cloud) solo debe existir para respaldos, proxies de acceso remoto o descarga de cómputo pesado (ej. modelos avanzados de IA), nunca para encender una luz.
3. **AI-Ready (Preparado para IA)**: Los modelos de datos y los buses de eventos (event buses) están diseñados desde cero para ser consumidos e influenciados por agentes de IA. Esto significa tipado estricto, transiciones de estado predecibles y alta observabilidad.
4. **Spec-Driven (Basado en Especificaciones)**: Todo el desarrollo sigue el modelo de Desarrollo Basado en Especificaciones (Spec-Driven Development o SDD). No se escribe código sin una especificación previa.
5. **Sin Magia Implícita**: Todo es explícito.

## Audiencia Objetivo
- Clientes de hogares inteligentes (smart homes) premium.
- Usuarios que necesitan alta confiabilidad, instalaciones de nivel profesional y automatización avanzada, pero que rechazan los ecosistemas cerrados de los integradores tradicionales.

## No-Objetivos (Non-Goals)
- **No es una herramienta fragmentada para aficionados (hobbyists)**: Priorizamos la estabilidad y la arquitectura clara por sobre el soporte para cada dispositivo IoT DIY a través de scripts improvisados.
- **No es una plataforma puramente basada en la nube**: No dependemos de conectividad constante a internet para las operaciones principales.
- **No es un constructor de interfaces (UI builder)**: Aunque tendrá paneles de control (dashboards), el enfoque principal es un motor y una API potentes, no un creador de sitios web de "arrastrar y soltar" (drag-and-drop).
