import Foundation
import Security
enum OfflineCredentialStore {
 private static let query:[String:Any] = [kSecClass as String:kSecClassGenericPassword,kSecAttrService as String:"com.jacobabbott.roadshowdriver.offline-access",kSecAttrAccount as String:"current"]
 static func read()->OfflineAccess? {
  var q=query;q[kSecReturnData as String]=true;q[kSecMatchLimit as String]=kSecMatchLimitOne
  var value:CFTypeRef?;guard SecItemCopyMatching(q as CFDictionary,&value)==errSecSuccess,let data=value as? Data else{return nil}
  return try? JSONDecoder().decode(OfflineAccess.self,from:data)
 }
 static func set(_ access:OfflineAccess)throws {
  let data=try JSONEncoder().encode(access)
  let attributes:[String:Any]=[kSecValueData as String:data,kSecAttrAccessible as String:kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
  let status=SecItemUpdate(query as CFDictionary,attributes as CFDictionary)
  if status==errSecItemNotFound {var q=query;attributes.forEach{q[$0.key]=$0.value};guard SecItemAdd(q as CFDictionary,nil)==errSecSuccess else{throw OfflineError.invalid}}
  else if status != errSecSuccess {throw OfflineError.invalid}
 }
 static func clear(){SecItemDelete(query as CFDictionary)}
}
