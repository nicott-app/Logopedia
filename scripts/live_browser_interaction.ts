/**
 * ============================================================================
 * INTERACCIÓN EN VIVO EN EL NAVEGADOR — DIRECTOR Y DUEÑO DE CLÍNICA
 * Abre una ventana visible de Chrome e interactúa paso a paso con la clínica
 * ============================================================================
 * 
 * Ejecución: npx tsx scripts/live_browser_interaction.ts
 */

import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

const ARTIFACTS_DIR = 'C:\\Users\\NicolasTercero\\.gemini\\antigravity\\brain\\e39615e4-eb67-48e7-a4c2-28f369beb77f';

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runLiveBrowserSession() {
  console.log('\n================================================================================');
  console.log('🌐 INICIANDO SESIÓN EN VIVO EN EL NAVEGADOR');
  console.log('   Abriendo ventana visible de Google Chrome para interactuar con la clínica...');
  console.log('================================================================================\n');

  // Lanzar Chrome visible en el escritorio de Windows
  const browser = await chromium.launch({
    headless: false,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--start-maximized', '--window-size=1400,920']
  });

  const context = await browser.newContext({
    viewport: { width: 1366, height: 820 }
  });

  const page = await context.newPage();

  try {
    // 1. Navegar a la aplicación en producción
    console.log('📍 1. Navegando a https://timecare-clinic.web.app...');
    await page.goto('https://timecare-clinic.web.app', { waitUntil: 'networkidle' });
    await sleep(2000);

    // 2. Acceso como Administrador de la Clínica
    console.log('🔑 2. Pulsando Acceso Rápido / Modo Demo (Director: Dr. Nicolás Tercero)...');
    const demoBtn = page.locator('button:has-text("Acceso Rápido / Modo Demo (LogoPedia)")');
    await demoBtn.waitFor({ state: 'visible', timeout: 15000 });
    await sleep(1000);
    await demoBtn.click();
    
    // Esperar a entrar al Dashboard
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
    await sleep(3000);

    // Captura 1: Dashboard
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'live_1_dashboard.png'), fullPage: false });
    console.log('   📸 Captura guardada: live_1_dashboard.png');

    // 3. Inspeccionar Salas Físicas e Inventario Logopédico
    console.log('🚪 3. Navegando a Salas Físicas e Inventario Especializado...');
    await page.click('a[href="/dashboard/rooms"]');
    await page.waitForSelector('text=Salas y Gabinetes', { timeout: 10000 });
    await sleep(2500);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'live_2_rooms.png'), fullPage: false });
    console.log('   📸 Captura guardada: live_2_rooms.png');

    // 4. Inspeccionar Equipo Médico y Descansos Laborales
    console.log('👥 4. Navegando a Equipo Médico y Turnos de Personal...');
    await page.click('a[href="/dashboard/professionals"]');
    await page.waitForSelector('text=Equipo Médico', { timeout: 10000 });
    await sleep(2500);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'live_3_team.png'), fullPage: false });
    console.log('   📸 Captura guardada: live_3_team.png');

    // 5. Inspeccionar Servicios Clínicos y Tarifas
    console.log('🏷️ 5. Navegando a Catálogo de Servicios y Tarifas...');
    await page.click('a[href="/dashboard/services"]');
    await page.waitForSelector('text=Servicios Clínicos', { timeout: 10000 });
    await sleep(2500);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'live_4_services.png'), fullPage: false });
    console.log('   📸 Captura guardada: live_4_services.png');

    // 6. Inspeccionar Configuración General y Cumplimiento RGPD (CIF y DPO)
    console.log('⚖️ 6. Navegando a Configuración General y Cumplimiento RGPD (CIF, DPO)...');
    await page.click('a[href="/dashboard/general"]');
    await page.waitForSelector('text=Configuración General', { timeout: 10000 });
    await sleep(2000);
    // Scroll suave para visualizar los datos fiscales y sanitarios
    await page.evaluate(() => window.scrollBy({ top: 380, behavior: 'smooth' }));
    await sleep(2500);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'live_5_legal.png'), fullPage: false });
    console.log('   📸 Captura guardada: live_5_legal.png');

    // 7. Navegar al Directorio de Pacientes
    console.log('📝 7. Navegando a Directorio de Pacientes...');
    await page.click('a[href="/dashboard/patients"]');
    await page.waitForSelector('text=Directorio de Pacientes', { timeout: 10000 });
    await sleep(2000);

    // Buscar a Carla Navarro (caso con restricción hiper-estricta)
    console.log('🔍 8. Filtrando por "Carla" en el buscador...');
    const searchInput = page.locator('input[placeholder*="Buscar paciente"]');
    await searchInput.fill('Carla');
    await sleep(2000);

    // Abrir la ficha de Carla
    console.log('📂 9. Abriendo ficha médica de Carla Navarro Vega...');
    const carlaCard = page.locator('text=Carla Navarro').first();
    await carlaCard.click();
    await sleep(3000);

    // Captura Ficha Datos Generales de Carla
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'live_6_carla_general.png'), fullPage: false });
    console.log('   📸 Captura guardada: live_6_carla_general.png');

    // Ver Historial Clínico de Carla
    console.log('📋 10. Abriendo pestaña Historial Clínico...');
    const historyBtn = page.locator('button:has-text("Historial Clínico")');
    if (await historyBtn.isVisible()) {
      await historyBtn.click();
      await sleep(2500);
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'live_7_carla_history.png'), fullPage: false });
      console.log('   📸 Captura guardada: live_7_carla_history.png');
    }

    // Ver Cumplimiento Legal y Firma de Carla
    console.log('🛡️ 11. Abriendo pestaña Cumplimiento Legal y Consentimiento RGPD...');
    const legalBtn = page.locator('button:has-text("Cumplimiento Legal")');
    if (await legalBtn.isVisible()) {
      await legalBtn.click();
      await sleep(2500);
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'live_8_carla_signature.png'), fullPage: false });
      console.log('   📸 Captura guardada: live_8_carla_signature.png');
    }

    // 8. Navegar a la Agenda Semanal (Calendario Tetris)
    console.log('📅 12. Navegando a la Agenda Semanal del Centro...');
    await page.click('a[href="/dashboard/agenda"]');
    await page.waitForSelector('button:has-text("Asistente Inteligente")', { timeout: 15000 });
    await sleep(3000);

    // Click en el turno de Mediodía para enfocar el tramo de las 13:00
    const middayBtn = page.locator('button:has-text("Mediodía")');
    if (await middayBtn.isVisible()) {
      await middayBtn.click();
      await sleep(1500);
    }
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'live_9_agenda.png'), fullPage: false });
    console.log('   📸 Captura guardada: live_9_agenda.png');

    // 9. Abrir el Menú de Asistente Inteligente
    console.log('🤖 13. Desplegando el Menú del Asistente Inteligente...');
    const assistantBtn = page.locator('button:has-text("Asistente Inteligente")');
    if (await assistantBtn.isVisible()) {
      await assistantBtn.click();
      await sleep(1500);
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'live_10_assistant.png'), fullPage: false });
      console.log('   📸 Captura guardada: live_10_assistant.png');

      // 10. Abrir el Radar Semanal de Huecos
      console.log('⚡ 14. Abriendo el Radar Semanal de Huecos y Asignación Automática...');
      const radarBtn = page.locator('button:has-text("Radar semanal de huecos")');
      if (await radarBtn.isVisible()) {
        await radarBtn.click();
        await sleep(2500);
        await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'live_11_radar_modal.png'), fullPage: false });
        console.log('   📸 Captura guardada: live_11_radar_modal.png');
      }
    }

    console.log('\n================================================================================');
    console.log('✅ RECORRIDO EN DIRECTO COMPLETADO CON ÉXITO');
    console.log('   Manteniendo la ventana visible durante 30 segundos para tu visualización...');
    console.log('================================================================================\n');

    await sleep(30000);

  } catch (error) {
    console.error('❌ Error durante la sesión en vivo:', error);
  } finally {
    console.log('🔒 Finalizando y cerrando la instancia del navegador de prueba.');
    await browser.close().catch(() => {});
  }
}

runLiveBrowserSession().catch(console.error);
