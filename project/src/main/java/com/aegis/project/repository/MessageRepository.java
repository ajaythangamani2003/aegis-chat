package com.aegis.project.repository;

import com.aegis.project.model.Message;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

public interface MessageRepository extends JpaRepository<Message, Long> {

    // 🔥 history
    List<Message> findBySenderOrReceiverOrderByIdAsc(String sender, String receiver);

    // 🔥 chat list users
    @Query("SELECT DISTINCT CASE WHEN m.sender = :username THEN m.receiver ELSE m.sender END FROM Message m WHERE m.sender = :username OR m.receiver = :username")
    List<String> findChatUsers(String username);

    @Query("SELECT DISTINCT m.sender FROM Message m")
    List<String> findAllSenders();

    @Query("SELECT DISTINCT m.receiver FROM Message m")
    List<String> findAllReceivers();

    @Query("SELECT COUNT(m) FROM Message m WHERE m.receiver = :username AND m.isRead = false")
    int countUnread(String username);

    @Query("""
    SELECT m.sender, COUNT(m)
    FROM Message m
    WHERE m.receiver = :receiver AND m.isRead = false
    GROUP BY m.sender
""")
    List<Object[]> countUnreadByReceiver(String receiver);

    @Modifying
    @Query("UPDATE Message m SET m.isRead = true WHERE m.sender = :sender AND m.receiver = :receiver")
    void markAsRead(String sender, String receiver);
}