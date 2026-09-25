import { defaultDatabaseDirectory, openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import type { PropsWithChildren } from 'react';
import { createContext, useContext, useEffect, useRef, useState } from 'react';

import { AppScreen } from '@/src/components/AppScreen';
import { DatabaseRecoveryPanel } from '@/src/components/DatabaseRecoveryPanel';
import { PageHeader } from '@/src/components/PageHeader';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenMessage } from '@/src/components/ScreenMessage';
import { DATABASE_NAME, migrateDatabase } from '@/src/database/schema';

const DatabaseContext = createContext<SQLiteDatabase | null>(null);
const RECOVERY_DATABASE_PATH = defaultDatabaseDirectory
  ? `${defaultDatabaseDirectory}/${DATABASE_NAME}`
  : DATABASE_NAME;

export function useAppDatabase(): SQLiteDatabase {
  const database = useContext(DatabaseContext);
  if (!database) throw new Error('O armazenamento seguro do Ampara ainda não está pronto.');
  return database;
}

export function DatabaseProvider({ children }: PropsWithChildren) {
  const [database, setDatabase] = useState<SQLiteDatabase | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const currentDatabase = useRef<SQLiteDatabase | null>(null);

  useEffect(() => {
    let active = true;
    let openedDatabase: SQLiteDatabase | null = null;
    setDatabase(null);
    setError('');

    void (async () => {
      try {
        openedDatabase = await openDatabaseAsync(DATABASE_NAME, { useNewConnection: true });
        const readyDatabase = await migrateDatabase(openedDatabase);
        if (!active) {
          if (readyDatabase !== openedDatabase) await openedDatabase.closeAsync().catch(() => undefined);
          await readyDatabase.closeAsync().catch(() => undefined);
          return;
        }
        currentDatabase.current = readyDatabase;
        setDatabase(readyDatabase);
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'Não foi possível preparar o banco seguro.');
        }
        if (openedDatabase) await openedDatabase.closeAsync().catch(() => undefined);
      }
    })();

    return () => {
      active = false;
      const db = currentDatabase.current;
      currentDatabase.current = null;
      if (db) void db.closeAsync().catch(() => undefined);
    };
  }, [attempt]);

  if (!database) {
    return (
      <AppScreen>
        <PageHeader
          eyebrow="AMPARA FAMÍLIA"
          title={error ? 'Não foi possível preparar o banco seguro.' : 'Preparando o armazenamento seguro.'}
          subtitle={error
            ? 'O acesso aos registros está pausado. Mantenha o app instalado e não apague os dados deste aparelho.'
            : 'A atualização prepara a criptografia no aparelho antes de abrir seus registros.'}
        />
        {error ? (
          <>
            <ScreenMessage tone="error" title="Não foi possível abrir o banco seguro" message={error} />
            <PrimaryButton title="Tentar novamente" onPress={() => setAttempt((value) => value + 1)} />
            <ScreenMessage title="Mantenha este aparelho" message="Não desinstale o Ampara nem limpe os dados do app. A recuperação abaixo exige um backup válido e substituirá o banco que não abriu; confirme que o arquivo contém os registros que deseja manter." />
            <DatabaseRecoveryPanel
              databasePath={RECOVERY_DATABASE_PATH}
              onRecovered={() => setAttempt((value) => value + 1)}
            />
          </>
        ) : (
          <ScreenMessage title="Um momento" message="Protegendo os registros locais. Isso acontece durante a atualização." />
        )}
      </AppScreen>
    );
  }

  return <DatabaseContext.Provider value={database}>{children}</DatabaseContext.Provider>;
}
