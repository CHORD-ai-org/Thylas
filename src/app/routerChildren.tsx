import { Navigate, useParams } from 'react-router-dom';
import { routes } from '../lib/routes';
import { Overview } from '../pages/Overview';
import { Recently } from '../pages/Recently';
import { FilesPage, FileDetailPage } from '../pages/Files';
import { BoardsPage, BoardDetailPage } from '../pages/Boards';
import { ProcessesPage, RunDetailPage } from '../pages/Processes';
import { NotesPage } from '../pages/Notes';
import { AccountPage } from '../pages/Account';
import { NotFound } from '../pages/NotFound';

function WorkspaceRedirect() {
  const { wsId = '' } = useParams();
  return <Navigate to={routes.files(wsId)} replace />;
}

export const routerChildren = [
  { index: true, element: <Navigate to={routes.overview()} replace /> },
  { path: 'overview', element: <Overview /> },
  { path: 'recently', element: <Recently /> },
  { path: 'w/:wsId', element: <WorkspaceRedirect /> },
  { path: 'w/:wsId/files', element: <FilesPage /> },
  { path: 'w/:wsId/files/:fileId', element: <FileDetailPage /> },
  { path: 'w/:wsId/boards', element: <BoardsPage /> },
  { path: 'w/:wsId/boards/:boardId', element: <BoardDetailPage /> },
  { path: 'w/:wsId/processes', element: <ProcessesPage /> },
  { path: 'w/:wsId/processes/:runId', element: <RunDetailPage /> },
  { path: 'notes', element: <NotesPage /> },
  { path: 'notes/:noteId', element: <NotesPage /> },
  { path: 'account', element: <Navigate to={routes.account()} replace /> },
  { path: 'account/:section', element: <AccountPage /> },
  { path: '*', element: <NotFound /> },
];
