export interface ProfileModalProps {
  open: boolean;
  defaultTab?: 'profile' | 'password';
  onClose: () => void;
}
